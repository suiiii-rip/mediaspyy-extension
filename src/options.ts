import {
    SpyyConfig,
    defaultConfig
} from "./types";

const getInput = (id: string): HTMLInputElement | null => {
    return (<HTMLInputElement>document.getElementById(id));
}

const populate = () => {

    console.debug("populating options page with default", defaultConfig);
    chrome.storage.local.get(defaultConfig, config => {
        console.debug("Populating config options with actual", config);

        Object.keys(defaultConfig).forEach(v => {
            const input = getInput(v);
            const value = config[v];
            // handle checkboxes for boolean values
            if (typeof value === "boolean") {
                input.checked = value;
            } else {
                input.value = config[v];
            }
        });
    })
};

const save = () => {
    console.debug("Saving options");

    const config = Object.fromEntries(
        Object.entries(defaultConfig).map(i => {
            const [k, v] = i;
            const input = getInput(k);
            // handle checkboxes for boolean values
            const value = typeof v === "boolean" ? input.checked : input.value;
            return [k, value];
    }));

    chrome.storage.local.set(config, () => {

        console.log("saved options", config);
    });
};
// TODO does this work embedded?
window.onload = () => {

    console.debug("Starting options page");
    populate();
    document.getElementById("save").addEventListener("click", () => save())
}
