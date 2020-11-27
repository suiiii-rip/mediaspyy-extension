console.log("hello options");

const populate = () => {

    console.debug("populating options page");
    chrome.storage.local.get({
        historyEntries: 3
    }, config => {
        const historyEntriesInput = (<HTMLInputElement>document.getElementById("history_entries"));
        historyEntriesInput.value = config.historyEntries;
    })
};

const save = () => {
    console.debug("Saving options");
    const historyEntriesInput = (<HTMLInputElement>document.getElementById("history_entries"));

    const historyEntries = historyEntriesInput.value;

    chrome.storage.local.set({historyEntries: historyEntries}, () => {

        console.log("saved options");
    });
};
// TODO does this work embedded?
window.onload = () => {

    console.debug("Starting options page");
    populate();
    document.getElementById("save").addEventListener("click", () => save())
}
