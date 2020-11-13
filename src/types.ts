export const MediaDataChangeKey = "MediaSpyy_MediaDataChangeKey";

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
