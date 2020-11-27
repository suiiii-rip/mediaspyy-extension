import {
    SpyyMessage,
    ChangeHandlerHistory,
    MediaData
} from './types';

console.log("Hello, popup");

function populate() {

    chrome.runtime.sendMessage({
        key: ChangeHandlerHistory,
        data: {}
    }, data => {
        const media = data as Array<MediaData>;
        console.log("Handling history resonse", data);
        const history = document.getElementById("media_history");

        media.forEach(m => {
            const li = document.createElement("li");
            li.innerText = `${m.artist} - ${m.title}`;

            history.append(li);
        });
    });

}

window.onload = () => populate();
