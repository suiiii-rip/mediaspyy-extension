export const MediaDataChangeKey = "MediaSpyy_MediaDataChangeKey";

// ChangeHandler keys
export const ChangeHandlerChange = "ChangeHandler_Change"
export const ChangeHandlerHistory = "ChangeHandler_History"

export interface MediaData {
    readonly url: string;
    readonly title: string;
    readonly artist: string;
    readonly images: Array<MediaImage>;
    readonly playbackState: "none" | "paused" | "playing";
    readonly album?: string;
};


export interface MediaImage {
    readonly src: string;
    readonly size?: string;
    readonly type?: string;
};

export interface SpyyMessage {
    key: string,
    data: any
}

export interface SpyyConfig {
    historyEntries: number,
    useExternal: boolean,
    serverUrl: string,
    serverUser: string,
    serverPassword: string
}

export const defaultConfig: SpyyConfig = {
    historyEntries: 3,
    useExternal: false,
    serverUrl: "http://localhost:8080/",
    serverUser: "foo",
    serverPassword: "bar"
}
