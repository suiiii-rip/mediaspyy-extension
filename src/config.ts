import {
    defaultConfig,
    SpyyConfig
} from './types';

export interface ConfigService {
    get(): Promise<SpyyConfig>

    set(config: SpyyConfig): Promise<SpyyConfig>
}

export class LocalStorageConfigService implements ConfigService {
    async get(): Promise<SpyyConfig> {
        console.debug('Loading config from local storage, using default',
                      defaultConfig);

        return new Promise<SpyyConfig>((res, rej) => {

            chrome.storage.local.get(defaultConfig, config => {

                console.debug('returning config from local storage, using default',
                              config, defaultConfig);

                res(config as SpyyConfig);
            });
        });
    }
    async set(config: SpyyConfig): Promise<SpyyConfig> {

        console.debug('Saving config to local storage', config);

        return new Promise<SpyyConfig>((res, rej) => {
            chrome.storage.local.set(config, () => {
                console.debug('Saved config to local storage', config);
                res(config);
            });
        });
    }
}

export const configService: ConfigService = new LocalStorageConfigService();
