import {
    MediaDataChangeKey,
    MediaData
} from './types';
//inject injection script into page context and await messages

var s = document.createElement('script');
s.src = chrome.extension.getURL('js/pageInject.js');
(document.head||document.documentElement).appendChild(s);
s.onload = function() {
    s.remove();
};

document.addEventListener(MediaDataChangeKey, function(e: CustomEvent<MediaData>) {

    console.log(`Received message from page: ${JSON.stringify(e.detail)}`);
    chrome.runtime.sendMessage({title: e.detail});
});
