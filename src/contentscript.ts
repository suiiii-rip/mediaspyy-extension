import {
    MediaDataChangeKey,
    MediaData
} from './types';
import {s} from './util';
import equal from 'deep-equal';


//inject injection script into page context and await messages

var script = document.createElement('script');
script.src = chrome.extension.getURL('js/pageInject.js');
(document.head || document.documentElement).appendChild(script);
script.onload = function () {
    script.remove();
};

function isPlaying(m: MediaData): boolean {
    return m.playbackState === "playing";
}

class ChangeHandler {

    private isPlaying: (_: MediaData) => boolean

    private isEqual: (a: MediaData, b: MediaData) => boolean

    private current: MediaData | null = null;

    constructor(isPlaying: (_: MediaData) => boolean,
                isEqual: (a: MediaData, b: MediaData) => boolean) {

        this.isPlaying = isPlaying;
        this.isEqual = isEqual;
    }

    public handle(e: CustomEvent<MediaData>) {

        const mediaData = e.detail;

        console.trace(`Received message from page: ${s(mediaData)}`);
        if (this.isPlaying(mediaData)) {
            if (!this.isEqual(this.current, mediaData)) {
                console.debug(
                    `Sending new playing media data ${s(mediaData)} to backend`);
                    this.current = mediaData;
                    chrome.runtime.sendMessage(mediaData);
            }
        } else {
            console.debug(`Media not playing, dropping info`);
            // reset current in case we resume playing the same media again way
            // later
            this.current = null;
        }
    }
}

// init handler
const handler = new ChangeHandler(isPlaying, equal);

document.addEventListener(MediaDataChangeKey, function (e: CustomEvent<MediaData>) {
    handler.handle(e);
});
