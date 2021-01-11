import {
  MediaDataChangeKey,
  MediaData,
  MediaImage,
  GenericLocation,
} from './types';
import {s} from './util';

interface ScheduledMediaPolling {
  (mediaPoll: Function,
  reschedule: ScheduledMediaPolling,
  delay: number, backoff: number): void;
}

interface MediaPoll {
  (): MediaData | null
}

console.debug(`Injected media listener into page context`);

const mediaPoll: MediaPoll = () => {

  console.debug(`Polling media session for metadata`);

  const metadata = navigator.mediaSession.metadata;
  if (metadata == null) {
    console.debug(`MediaSession is empty, returning empty media data`);
    return null;
  }

  const currentUrl = window.location.href;
  const images: Array<MediaImage> = metadata.artwork.map((a) => {
    return {
      src: a.src,
      size: a.sizes,
      type: a.type
    };
  });

  const mediaData: MediaData = {
    locations: [{ type: GenericLocation, url: currentUrl }],
    title: metadata.title,
    artist: metadata.artist,
    album: metadata.album,
    images: images,
    playbackState: navigator.mediaSession.playbackState
  };

  console.debug(`Sending media data '${s(mediaData)}' to backend`);

  document.dispatchEvent(new CustomEvent<MediaData>(MediaDataChangeKey, {
      detail: mediaData
  }));

  console.debug(`Returning found media data`);

  return mediaData;
};


const scheduleMediaPoll: ScheduledMediaPolling = (mediaPoll: MediaPoll,
                                    reschedule: ScheduledMediaPolling,
                                    delay: number,
                                    backoff: number) => {
  const mediaData = mediaPoll();

  const scheduleDelay = mediaData === null ? backoff : delay;

  console.debug(`Scheduling mediaPoll in ${scheduleDelay}`);

  setTimeout(() => {
    reschedule(mediaPoll, reschedule, delay, backoff);
  }, scheduleDelay);
};

scheduleMediaPoll(mediaPoll, scheduleMediaPoll, 5000, 10000);
