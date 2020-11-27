import {
    MediaData,
    SpyyMessage,
    ChangeHandlerChange,
    ChangeHandlerHistory
} from './types';
import { s } from './util'
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

const mediaHandler = new MediaHandler(new ArrayMediaStorage());

chrome.runtime.onMessage.addListener(async (msg, _, sendResponse) => {
    const m = <SpyyMessage> msg;
    const key = m.key;

    if (key === ChangeHandlerChange) {
        mediaHandler.handleChange(<MediaData> m.data)
    } else if (key === ChangeHandlerHistory) {
        const history = await mediaHandler.history();

        sendResponse(history);
    }
});
