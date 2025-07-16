import * as FileSystem from 'expo-file-system';

import { Alert } from 'react-native';
import { useTranslation } from './useTranslation';

export const useStorageAccessFramework = () => {
    const { t } = useTranslation();

    // Function to request directory permissions using SAF
    const requestDirectoryPermissions = async (): Promise<string | null> => {
        try {
            // Use SAF to pick a directory
            const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

            if (result.granted) {
                console.log('Directory permissions granted:', result.directoryUri);
                return result.directoryUri;
            } else {
                console.warn('Directory permissions not granted');
                Alert.alert(
                    t('permissionsNotGranted'),
                    t('permissionsNotGrantedMessage'),
                    [{ text: t('ok') }]
                );
            }
        } catch (error) {
            console.error('Error requesting directory permissions:', error);
        }

        return null;
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
