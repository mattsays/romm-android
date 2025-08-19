import AsyncStorage from '@react-native-async-storage/async-storage';

export class SettingsService {
    static async getEmuJsEnabled(): Promise<boolean> {
        try {
            const value = await AsyncStorage.getItem('emuJsEnabled');
            if (value !== null) {
                return JSON.parse(value);
            }
            return true; // Default value
        } catch (error) {
            console.error('Error loading EmuJS setting:', error);
            return true; // Default fallback
        }
    }

    static async setEmuJsEnabled(enabled: boolean): Promise<void> {
        try {
            await AsyncStorage.setItem('emuJsEnabled', JSON.stringify(enabled));
        } catch (error) {
            console.error('Error saving EmuJS setting:', error);
            throw error;
        }
    }

    static async getUnzipFilesOnDownload(): Promise<boolean> {
        try {
            const value = await AsyncStorage.getItem('unzipFilesOnDownload');
            if (value !== null) {
                return JSON.parse(value);
            }
            return true; // Default value
        } catch (error) {
            console.error('Error loading unzip setting:', error);
            return true; // Default fallback
        }
    }

    static async getConcurrentDownloads(): Promise<number> {
        try {
            const value = await AsyncStorage.getItem('concurrentDownloads');
            if (value !== null) {
                const numValue = parseInt(value, 10);
                // Ensure the value is between 1 and 5
                if (numValue >= 1 && numValue <= 5) {
                    return numValue;
                }
            }
            return 2; // Default value
        } catch (error) {
            console.error('Error loading concurrent downloads setting:', error);
            return 2; // Default fallback
        }
    }
}
