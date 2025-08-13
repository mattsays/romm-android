import { openDocumentTree } from "@joplin/react-native-saf-x";
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { useTranslation } from './useTranslation';


export interface StorageAccessError extends Error {
    type: 'permissions_denied' | 'request_failed' | 'platform_not_supported';
}

export const useStorageAccessFramework = () => {
    const { t } = useTranslation();

    // Function to check if SAF is available on this platform
    const isSafAvailable = (): boolean => {
        return Platform.OS === 'android'; // Only Android supports SAF
    };

    // Function to request directory permissions using SAF
    const requestDirectoryPermissions = async (): Promise<string | null> => {
        try {
            // Check if we're on an emulator or iOS where SAF doesn't work properly
            if (!isSafAvailable()) {
                // Use the app's documents directory as a fallback
                const documentsDir = FileSystem.documentDirectory;
                if (documentsDir) {
                    await FileSystem.makeDirectoryAsync(documentsDir, { intermediates: true });
                    console.log('Using fallback directory:', documentsDir);
                    return documentsDir;
                }
                // If documents directory is not available, throw an error
                const error = new Error('Storage access not available on this platform or emulator. Using app documents directory.') as StorageAccessError;
                error.type = 'platform_not_supported';
                throw error;
            }


            // Use SAF to pick a directory (Android only)
            const result = await openDocumentTree(true);
            console.log('SAF result:', result);

            if (!result || !result.uri) {
                const error = new Error(t('permissionsNotGrantedMessage')) as StorageAccessError;
                error.type = 'permissions_denied';
                throw error;
            }

            return result.uri;
        } catch (error) {
            console.error('Error requesting directory permissions:', error);
            if ((error as StorageAccessError).type) {
                throw error; // Re-throw our custom errors
            }
            const requestError = new Error(t('error')) as StorageAccessError;
            requestError.type = 'request_failed';
            throw requestError;
        }
    };

    // Function to read the contents of a directory
    const readDirectoryContents = async (folderUri: string): Promise<string[]> => {
        try {
            if (Platform.OS === 'android') {
                return await FileSystem.StorageAccessFramework.readDirectoryAsync(folderUri);
            } else {
                // For iOS, use expo-file-system
                return await FileSystem.readDirectoryAsync(folderUri);
            }
        } catch (error) {
            console.error('Error reading directory contents:', error);
        }

        return [];
    };

    // Function to check if we still have permissions for a folder
    const checkDirectoryPermissions = async (folderUri: string): Promise<boolean> => {
        try {
            if (Platform.OS === 'android') {
                await FileSystem.StorageAccessFramework.readDirectoryAsync(folderUri);
            } else {
                // For iOS, use expo-file-system to check if directory exists and is accessible
                const fileInfo = await FileSystem.getInfoAsync(folderUri);
                return fileInfo.exists && fileInfo.isDirectory;
            }
        } catch (error) {
            console.error('Error checking permissions:', error);
            return false;
        }

        return true;
    };

    return {
        requestDirectoryPermissions,
        readDirectoryContents,
        checkDirectoryPermissions,
        isSafAvailable,
    };
};
