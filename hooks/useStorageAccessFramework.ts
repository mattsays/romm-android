import * as FileSystem from 'expo-file-system';
import { openDocumentTree, mkdir, createFile } from "@joplin/react-native-saf-x";
import { useTranslation } from './useTranslation';

export interface StorageAccessError extends Error {
    type: 'permissions_denied' | 'request_failed';
}

export const useStorageAccessFramework = () => {
    const { t } = useTranslation();

    // Function to request directory permissions using SAF
    const requestDirectoryPermissions = async (): Promise<string | null> => {
        try {
            // Use SAF to pick a directory
            const result = await openDocumentTree(true);
            console.log('SAF result:', result);

            if (!result || !result.uri) {
                const error = new Error(t('permissionsNotGrantedMessage')) as StorageAccessError;
                error.type = 'permissions_denied';
                throw error;
            }

            return result.uri;
            // if (result.granted) {
                
            // } else {
            //     console.warn('Directory permissions not granted');
            //     const error = new Error(t('permissionsNotGrantedMessage')) as StorageAccessError;
            //     error.type = 'permissions_denied';
            //     throw error;
            // }
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
            return await FileSystem.StorageAccessFramework.readDirectoryAsync(folderUri);
        } catch (error) {
            console.error('Error reading directory contents:', error);
        }

        return [];
    };

    // Function to check if we still have permissions for a folder
    const checkDirectoryPermissions = async (folderUri: string): Promise<boolean> => {
        try {
            await FileSystem.StorageAccessFramework.readDirectoryAsync(folderUri);
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
    };
};
