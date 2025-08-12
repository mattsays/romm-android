import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { version } from '../package.json';

const GITHUB_API_URL = 'https://api.github.com/repos/mattsays/romm-android/releases/latest';

export interface Release {
    tag_name: string;
    name: string;
    body: string;
    assets: Asset[];
}

export interface Asset {
    name: string;
    browser_download_url: string;
    size: number;
}

class UpdateService {
    async checkForUpdates(): Promise<Release | null> {
        try {
            const response = await fetch(GITHUB_API_URL);
            if (!response.ok) {
                throw new Error(`GitHub API returned ${response.status}`);
            }
            const release: Release = await response.json();

            // Compare versions
            if (this.isNewerVersion(release.tag_name, version)) {
                return release;
            }
            return null;
        } catch (error) {
            console.error('Failed to check for updates:', error);
            throw error;
        }
    }

    async downloadUpdate(
        asset: Asset,
        onProgress: (progress: number) => void
    ): Promise<void> {
        if (Platform.OS !== 'android') {
            throw new Error('Updates are only supported on Android.');
        }

        const downloadDest = FileSystem.cacheDirectory + asset.name;

        const downloadResumable = FileSystem.createDownloadResumable(
            asset.browser_download_url,
            downloadDest,
            {},
            (downloadProgress) => {
                const progress =
                    downloadProgress.totalBytesWritten /
                    downloadProgress.totalBytesExpectedToWrite;
                onProgress(progress);
            }
        );

        try {
            const res = await downloadResumable.downloadAsync();
            console.log('Finished downloading to ', res?.uri);
            this.installUpdate(res?.uri || '');
        } catch (e) {
            console.error(e);
            throw new Error('Failed to download update.');
        }
    }

    private async installUpdate(uri: string): Promise<void> {
        try {
            const contentUri = await FileSystem.getContentUriAsync(uri);
            console.log('Installing update from:', contentUri);
            const res = await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
                data: contentUri, // Convert file URI to content URI
                flags: 0x10000000 | 1, // FLAG_ACTIVITY_NEW_TASK | FLAG_GRANT_READ_URI_PERMISSION
                type: 'application/vnd.android.package-archive',
            });
            console.log('Update installation started:', res);
        } catch (e) {
            console.error('Failed to install update:', e);
            throw new Error('Failed to start installer.');
        }
    }

    private isNewerVersion(latest: string, current: string): boolean {
        const latestParts = latest.replace('v', '').split('.').map(Number);
        const currentParts = current.split('.').map(Number);

        for (let i = 0; i < latestParts.length; i++) {
            if (latestParts[i] > (currentParts[i] || 0)) {
                return true;
            }
            if (latestParts[i] < (currentParts[i] || 0)) {
                return false;
            }
        }
        return false;
    }
}

export const updateService = new UpdateService();
