import {
    MediaData
} from './types';
import { s } from './util'
import equal from 'deep-equal';

interface MediaStorage {

    push(mediaData: MediaData): Promise<MediaData>

    peek(): Promise<MediaData | null>
}

class ArrayMediaStorage implements MediaStorage {
    private arr: Array<MediaData> = new Array();

    push(mediaData: MediaData): Promise<MediaData> {
        this.arr.push(mediaData);
        console.debug(`New current stoage: ${s(this.arr)}`);
        return Promise.resolve(mediaData);
    }
    peek(): Promise<MediaData | null> {
        const val = this.arr[this.arr.length - 1];
        return Promise.resolve(val ? val : null);
    }
}


class MediaHandler {

    private readonly storage: MediaStorage;

    constructor(mediaStorage: MediaStorage) {

        this.storage = mediaStorage;
    }

    public async handle(mediaData: MediaData): Promise<void> {
        // TODO handle multiple tabs playing at the same time
        console.debug(`Message received ${s(mediaData)}`)

        const current = await this.storage.peek();

        if (!equal(current, mediaData)) {
            await this.storage.push(mediaData);
            console.debug(`Adding new media data ${s(mediaData)} to storage`);
        }
    }

}

const mediaHandler = new MediaHandler(new ArrayMediaStorage());

chrome.runtime.onMessage.addListener(msg => mediaHandler.handle(msg));
