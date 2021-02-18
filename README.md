# MediaSpyy

A browser extension that listens to the MediaSession API and publishes played
media titles and URLs to a configured backend.

## Setup

```bash
npm install
```

## Build

```bash
npm run build
```

Watch mode:

```bash
npm run watch
```

## Loading extension

Load the `dist` folder as an unpacked extension.

## Testing with Mountebank

[Mountebank](http://www.mbtest.org/) can be used for local development and
testing without the need to have the backend server running.

You can start mountebank via docker and configure it by loading a http imposter
using the REST api:

```bash
docker run -p 2525:2525 -p 8080:8080  andyrbell/mountebank
curl -v -X POST -H "Content-Type: application/json" \
  -d @mountebank/imposter.json http://localhost:2525/imposters
```

A mocked backend is then available on `localhost:8080` with user `test` and
password `test`.

## Credits

Thanks to
[chibat](https://github.com/chibat/chrome-extension-typescript-starter) for
providing a starter project.


# TODO

- Only send media info to backend if user stream is online
    Optional setting, if creds available
    Twitch API Stream endpoint: https://api.twitch.tv/helix/streams
    Authenticate with twitch: implicit flow or app token
- use browser sync to sync options across multiple instances
