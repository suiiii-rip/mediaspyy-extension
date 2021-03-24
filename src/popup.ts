import {
    SpyyMessage,
    ChangeHandlerDeleteItem,
    ChangeHandlerHistory,
    ChangeHandlerHistoryResponse,
    ChangeHandlerHistoryError,
    MediaData,
} from './types';

console.debug("Initializing popup");

function handleHistory(media: Array<MediaData>) {
    console.debug("Handling history resonse", media);
    const history = document.getElementById("media_history");

    media.forEach(m => {
        const link = document.createElement("a");
        const del = document.createElement("a");
        // TODO handle null?
        link.setAttribute("href", m.locations.find(l => l.type === 'generic').url);
        link.setAttribute("target", "_blank");
        link.innerText = "go to";

        del.innerText = "delete";
        del.setAttribute("href", "#");
        del.onclick = ev => {
            ev.preventDefault();
            // TODO create some sort of 'loading' indicator
            deleteMedia(m);
            return false;
        };

        const li = document.createElement("li");
        li.innerText = `${m.artist} - ${m.title}`;
        li.append(" ", link, " ", del);


        history.append(li);
    });
}

function handleError() {

    const history = document.getElementById("media_history");
    history.innerText = "Failed to load history";

}

function deleteMedia(media: MediaData) {
    console.debug(`Sending delete command for ${media.id} to backend`);

    chrome.runtime.sendMessage({
        key: ChangeHandlerDeleteItem,
        data: media
    }, handleContent);

}

function clearHistory() {
    console.log(`Deleting history items from list`);

    const history = document.getElementById("media_history");
    while (history.firstChild) {
        history.firstChild.remove();
    }
}

function handleContent(data: any) {

        const msg = <SpyyMessage> data;

        clearHistory();

        if (msg.key === ChangeHandlerHistoryError) {
            console.error('Received error on history request');
            handleError();
        } else if (msg.key === ChangeHandlerHistoryResponse) {
            console.debug('Received history data', msg.data);
            handleHistory(msg.data);
        } else {
            console.error('unable to handle message', msg);
        }
        // TODO remove 'loading' indicator
}

function populate() {

    chrome.runtime.sendMessage({
        key: ChangeHandlerHistory,
        data: {}
    }, handleContent);

}

window.onload = () => populate();
