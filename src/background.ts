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

interface ActiveCheck {

    isActive(): Promise<boolean>
}

class TwitchActiveCheck implements ActiveCheck {

    private accessToken: string;
    private credsChecksum = "";
    // auth with id and secret to get app access token
    // check online status of user from stream api
    async isActive(): Promise<boolean> {
        const conf = await configService.get();

        const username = conf.twitchUser;
        const clientId = conf.twitchClientId;
        const clientSecret = conf.twitchClientSecret;

        console.debug(`Querying user ${username} online status`);

        const checksum = clientId + clientSecret;
        if (checksum !== this.credsChecksum) {
            this.credsChecksum = checksum;
            this.accessToken = "";
        }

        const doCheck: (token: string) => Promise<[string, boolean]> =
            async (token) => {

                const query = async (t: string) => this.queryStreamState(t, clientId, username);
                const authAndQuery: () => Promise<[string, boolean]> = async () => {
                    const newToken = await this.authenticate(clientId, clientSecret);
                    const active = await query(newToken);
                    return [newToken, active];
                }

                if (!token) {
                    return authAndQuery();
                }

                try {
                    const active = await query(token);
                    return [token, active];
                } catch (error) {
                    // TODO check forbidden error
                    // TODO retry in case of other failure?
                    return authAndQuery();
                }
            }

        const [newToken, result] = await doCheck(this.accessToken);

        this.accessToken = newToken;
        return result;
    }

    private async authenticate(clientId: string, clientSecret: string): Promise<string> {
        console.debug(`Authenticating with clientId ${clientId}`);
        const url = new URL("https://id.twitch.tv/oauth2/token");
        const params = url.searchParams;
        params.append("client_id", clientId);
        params.append("client_secret", clientSecret);
        params.append("grant_type", "client_credentials");

        const response = await fetch(url.toString(), {
            method: 'POST'
        });

        if (response.ok) {
            console.debug(`Received access token for clientId ${clientId}`);
            const res = await response.json();
            return res.access_token;
        }

        console.error(`Failed to authenticate with clientId ${clientId}`);
        throw new AuthenticationError("Authentication request returned a not ok answer");
    }

    private async queryStreamState(token: string, clientId: string, username: string): Promise<boolean> {
        console.debug(`Querying user ${username} with clientId ${clientId}`);

        const url = new URL("https://api.twitch.tv/helix/streams");
        const params = url.searchParams;
        params.append("user_login", username);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: new Headers({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Client-Id': clientId
            })
        });

        if (response.ok) {
            const res = await response.json();
            console.debug(`Received stream data for user ${username}: ${JSON.stringify(res)}`);
            const live = res?.data?.[0]?.type;
            console.debug(`Received live status: ${live}`);
            return "live" === live;

        }
        console.error(`Failed to receive stream data for user ${username}: ${response.statusText}`);
        throw new TwitchQueryError("Query to twitch api failed with not ok");
    }
}

class AuthenticationError extends Error {}
class TwitchQueryError extends Error {}

// prevents adding new data to storage in case user is offline
class ActiveMediaStorageWrapper implements MediaStorage {

    private delegate: MediaStorage;
    private activeCheck: ActiveCheck;

    constructor(delegate: MediaStorage, activeCheck: ActiveCheck) {
        this.delegate = delegate;
        this.activeCheck = activeCheck;
    }

    private async checked<T>(func: () => Promise<T>, defaultVal: () => T): Promise<T> {
        const conf = await configService.get()

        if (!conf.queryOnlineStatus) {
            console.debug(`Active check is disabled, passing through`);
            return func();
        }

        if (conf.queryOnlineStatus && await this.activeCheck.isActive()) {
            console.debug(`Active check is enabled and user is active, passing through`);
            return func();
        }

        console.debug(`Did not pass active check, using provided default value`);
        return defaultVal();
    }

    async push(mediaData: MediaData): Promise<MediaData> {

        return this.checked(() => this.delegate.push(mediaData), () => mediaData);
    }

    peek(): Promise<MediaData | null> {
        return this.delegate.peek();
    }
    last(count: number): Promise<MediaData[]> {
        return this.delegate.last(count);
    }

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
    new ActiveMediaStorageWrapper(new ExternalMediaStorage(), new TwitchActiveCheck())));

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
