import {
    SpyyMessage,
    ChangeHandlerHistory,
    ChangeHandlerHistoryResponse,
    ChangeHandlerHistoryError,
    MediaData
} from './types';

console.debug("Initializing popup");

function handleHistory(media: Array<MediaData>) {
    console.debug("Handling history resonse", media);
    const history = document.getElementById("media_history");

    media.forEach(m => {
        const li = document.createElement("li");
        li.innerText = `${m.artist} - ${m.title}`;

        history.append(li);
    });
}

function handleError() {

    const history = document.getElementById("media_history");
    history.innerText = "Failed to load history";

}

function populate() {

    chrome.runtime.sendMessage({
        key: ChangeHandlerHistory,
        data: {}
    }, data => {
        const msg = <SpyyMessage> data;
        if (msg.key === ChangeHandlerHistoryError) {
            console.error('Received error on history request');
            handleError();
        } else if (msg.key === ChangeHandlerHistoryResponse) {
            console.debug('Received history data', msg.data);
            handleHistory(msg.data);
        } else {
            console.error('unable to handle message', msg);
        }
    });

}

window.onload = () => populate();
