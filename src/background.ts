import {
    MediaData,
    SpyyConfig,
    defaultConfig,
    SpyyMessage,
    ChangeHandlerChange,
    ChangeHandlerHistory
} from './types';
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

class ConfigAwareMediaStorageWrapper implements MediaStorage {
    private readonly interalStorage: MediaStorage;
    private readonly externalStorage: MediaStorage;

    constructor(interalStorage: MediaStorage,
               externalStorage: MediaStorage) {

                   this.interalStorage = interalStorage;
                   this.externalStorage = externalStorage;
               }

    private async doOnStorage<T>(func: (s: MediaStorage) => Promise<T>): Promise<T> {
        const defer = Defer.create<MediaStorage>();
        chrome.storage.local.get(defaultConfig, (config) => {
            const c = <SpyyConfig> config;

            const storage = c.useExternal ? this.externalStorage : this.interalStorage;
            // TODO handle error
            console.debug("Using storage", storage);
            defer.resolve(storage);
        });

        const storage = await defer.promise;
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
            await this.storage.push(mediaData);
            console.debug(`Adding new media data ${s(mediaData)} to storage`);
        }
    }

    public async history(): Promise<Array<MediaData>> {
        console.debug("Handling history request");
        const data = await this.storage.last(3);

        console.debug("Returning history data", data);
        return data;
    }
}

const mediaHandler = new MediaHandler(new ConfigAwareMediaStorageWrapper(
    new ArrayMediaStorage(),
    new ArrayMediaStorage()));

// we are not using an async function here as we need hands-on control of the
// listener life cycle to control the sendResponse validity
chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
    const m = <SpyyMessage> msg;
    const key = m.key;

    if (key === ChangeHandlerChange) {
        mediaHandler.handleChange(<MediaData> m.data)
        // close the response as we are not sending a respnse
        return false;
    } else if (key === ChangeHandlerHistory) {
        mediaHandler.history()
            .then(v => sendResponse(v));
        // keep sendResponse open as we are doing a bunch of async stuff
        return true;
    }
});
