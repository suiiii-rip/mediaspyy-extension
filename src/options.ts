import {
    SpyyConfig
} from "./types";
import {
    ConfigService,
    configService
} from "./config";

const getInput = (id: string): HTMLInputElement | null => {
    return (<HTMLInputElement>document.getElementById(id));
}

const populate = async () => {

    const config = await configService.get();
    console.debug("populating options page with provided", config);

    Object.keys(config).forEach(v => {
        const input = getInput(v);
        const value = config[v];
        // handle checkboxes for boolean values
        if (typeof value === "boolean") {
            input.checked = value;
        } else {
            input.value = config[v];
        }
    });
};

const save = async () => {
    console.debug("Saving options");

    const defaultConfig = await configService.get();

    const config = Object.fromEntries(
        Object.entries(defaultConfig).map(i => {
            const [k, v] = i;
            const input = getInput(k);
            // handle checkboxes for boolean values
            const value = typeof v === "boolean" ? input.checked : input.value;
            return [k, value];
    }));

    const savedConfig = await configService.set(config as unknown as SpyyConfig);

    console.debug("saved options", savedConfig);
};
// TODO does this work embedded?
window.onload = () => {

    console.debug("Starting options page");
    populate();
    document.getElementById("save").addEventListener("click", () => save())
}
