import {
    MediaData,
    SpyyConfig,
    SpyyMessage,
    ChangeHandlerChange,
    ChangeHandlerHistory,
    ChangeHandlerHistoryResponse,
    ChangeHandlerHistoryError
} from './types';
import {
    configService
} from './config';
import {
    s,
    Defer
} from './util'
import equal from 'deep-equal';

interface MediaStorage {

    push(mediaData: MediaData): Promise<MediaData>

    // TODO remove this?
    peek(): Promise<MediaData | null>

    last(count: number): Promise<Array<MediaData>>
}

class ExternalMediaStorage implements MediaStorage {

    // example http://localhost:8080/media?size=10
    static endpoint: string = "media";
    static countParam: string = "size";

    async push(mediaData: MediaData): Promise<MediaData> {
        const config = await configService.get();
        const baseUrlString = config.serverUrl;
        const user = config.serverUser;
        const password = config.serverPassword;

        const url = new URL(ExternalMediaStorage.endpoint,
                            baseUrlString).toString();

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + btoa(`${user}:${password}`)
                }),
                body: JSON.stringify(mediaData)
            });

            if (!response.ok) {
                console.error(`Response was not ok (${response.status}) from ${url.toString()}`, response);
                return Promise.reject(new Error(`Received code ${response.status} from ${url.toString()}`));
            }
            return mediaData;
        } catch (error) {
            console.error(`Failed to update history on ${url.toString()}`, error);
            return Promise.reject(error);
        }
    }

    async peek(): Promise<MediaData | null> {
        const history = await this.last(1);
        const val = history[0];
        return Promise.resolve(val ? val : null);
    }

    async last(count: number): Promise<MediaData[]> {
        const config = await configService.get();
        const baseUrlString = config.serverUrl;
        const user = config.serverUser;
        const password = config.serverPassword;

        const params = new URLSearchParams();
        params.append(ExternalMediaStorage.countParam, `${count}`);

        const url = new URL(ExternalMediaStorage.endpoint, baseUrlString);
        url.search = params.toString();

        try {
            console.debug('Requesting history data from', url);
            const response = await fetch(url.toString(), {
                headers: new Headers({
                    'Content-Type': 'application/json',
                    'Authorization': 'Basic ' + btoa(`${user}:${password}`)
                })
            });

            if (!response.ok) {
                console.error(`Response was not ok (${response.status}) from ${url.toString()}`, response);
                return Promise.reject(new Error(`Received error on loading history from ${url.toString()}`));
            }
            return response.json();
        } catch (error) {
            console.error(`Failed to load history from ${url.toString()}`, error);
            return Promise.reject(error);
        }
    }
}

// Storing data in memory is for debugging purposes only as extension
// background script gets unloaded rather quickly
class ArrayMediaStorage implements MediaStorage {
    private arr: Array<MediaData> = new Array();

    push(mediaData: MediaData): Promise<MediaData> {
        this.arr.push(mediaData);
        console.debug(`New current storage: ${s(this.arr.map(m => m.title))}`);
        return Promise.resolve(mediaData);
    }
    peek(): Promise<MediaData | null> {
        const val = this.arr[this.arr.length - 1];
        return Promise.resolve(val ? val : null);
    }
    last(count: number): Promise<Array<MediaData>> {

        const reversed = this.arr.slice(-Math.abs(count)).reverse();

        return Promise.resolve(reversed);
    }
}

interface LocalHistory {
    localMediaHistory: Array<MediaData>;
}

class LocalStorageMediaStorage implements MediaStorage {

    private readonly maxSize: number = 100;

    private localStorage: chrome.storage.LocalStorageArea = chrome.storage.local;

    private getLocalHistory(cb: (h: LocalHistory) => void): void {
        this.localStorage.get(<LocalHistory>{localMediaHistory: []}, cb);
    }

    async push(mediaData: MediaData): Promise<MediaData> {

        const defer = Defer.create<MediaData>();
        this.getLocalHistory(h => {
            console.debug("retrieved media history from local storage", h);

            const history = h.localMediaHistory.slice(- (this.maxSize - 1));
            history.push(mediaData);

            this.localStorage.set(<LocalHistory>{localMediaHistory: history}, () => {

                console.debug("Added new entry to local history", mediaData,
                    history);
                defer.resolve(mediaData);
            });
        });
        return defer.promise;
    }
    async peek(): Promise<MediaData> {
        const defer = Defer.create<MediaData>();
        this.getLocalHistory(h => {

            const history = h.localMediaHistory;
            const val = history[history.length - 1];
            console.debug("peeked last history entry", val);
            defer.resolve(val ? val : null);
        });
        return defer.promise;
    }
    async last(count: number): Promise<MediaData[]> {
        const defer = Defer.create<Array<MediaData>>();

        this.getLocalHistory(h => {
            const reversed = h.localMediaHistory.slice(-Math.abs(count)).reverse();
            console.debug("retrieved last history entries", reversed);
            defer.resolve(reversed);
        });

        return defer.promise;
    }
}

class ConfigAwareMediaStorageWrapper implements MediaStorage {
    private readonly interalStorage: MediaStorage;
    private readonly externalStorage: MediaStorage;

    constructor(interalStorage: MediaStorage,
        externalStorage: MediaStorage) {

        this.interalStorage = interalStorage;
        this.externalStorage = externalStorage;
    }

    private async doOnStorage<T>(func: (s: MediaStorage) => Promise<T>): Promise<T> {
        const c = await configService.get();

        const storage = c.useExternal ? this.externalStorage : this.interalStorage;
        console.debug("Using storage", storage);

        return func(storage);
    }

    async push(mediaData: MediaData): Promise<MediaData> {
        return this.doOnStorage(s => s.push(mediaData));
    }
    async peek(): Promise<MediaData> {
        return this.doOnStorage(s => s.peek());
    }
    async last(count: number): Promise<MediaData[]> {
        return this.doOnStorage(s => s.last(count));
    }
}


class MediaHandler {

    private readonly storage: MediaStorage;

    constructor(mediaStorage: MediaStorage) {

        this.storage = mediaStorage;
    }

    public async handleChange(mediaData: MediaData): Promise<void> {
        console.debug(`Message received ${s(mediaData)}`)

        const current = await this.storage.peek();

        if (!equal(current, mediaData)) {
            try {
                await this.storage.push(mediaData);
                console.debug(`Adding new media data ${s(mediaData)} to storage`);
            } catch (err) {
                console.error(`Failed to store new mediaData`, mediaData, err);
            }
        }
    }

    public async history(): Promise<Array<MediaData>> {
        console.debug("Handling history request");
        const config = await configService.get();
        const data = await this.storage.last(config.historyEntries);

        console.debug("Returning history data", data);
        return data;
    }
}

const mediaHandler = new MediaHandler(new ConfigAwareMediaStorageWrapper(
    new LocalStorageMediaStorage(),
    new ExternalMediaStorage()));

// we are not using an async function here as we need hands-on control of the
// listener life cycle to control the sendResponse validity
chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
    const m = <SpyyMessage>msg;
    const key = m.key;

    if (key === ChangeHandlerChange) {
        mediaHandler.handleChange(<MediaData>m.data)
        // close the response as we are not sending a respnse
        return false;
    } else if (key === ChangeHandlerHistory) {
        mediaHandler.history()
            .then(v => sendResponse(<SpyyMessage>{
                key: ChangeHandlerHistoryResponse,
                data: v
            }))
            .catch(err => {
                console.error('handling error response from looking up history', err);
                sendResponse(<SpyyMessage>{
                    key: ChangeHandlerHistoryError
                });
            });
        // keep sendResponse open as we are doing a bunch of async stuff
        return true;
    }
});
