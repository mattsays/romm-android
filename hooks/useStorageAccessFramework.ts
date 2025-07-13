import * as FileSystem from 'expo-file-system';

import { Alert, Platform } from 'react-native';

export const useStorageAccessFramework = () => {
    // Function to request directory permissions using SAF
    const requestDirectoryPermissions = async (): Promise<string | null> => {
        try {
            // Use SAF to pick a directory
            const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();

            if (result.granted) {
                console.log('Permessi della cartella concessi:', result.directoryUri);
                return result.directoryUri;
            } else {
                console.warn('Permessi della cartella non concessi');
                Alert.alert(
                    'Permessi non concessi',
                    'Non hai concesso i permessi per accedere alla cartella. Per favore, riprova.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Errore nel richiedere i permessi della cartella:', error);
        }

        return null;
    };

    // Function to read the contents of a directory
    const readDirectoryContents = async (folderUri: string): Promise<string[]> => {
        try {
            return await FileSystem.StorageAccessFramework.readDirectoryAsync(folderUri);
        } catch (error) {
            console.error('Errore nella lettura del contenuto della cartella:', error);
        }

        return [];
    };

    // Function to check if we still have permissions for a folder
    const checkDirectoryPermissions = async (folderUri: string): Promise<boolean> => {
        try {
            await FileSystem.StorageAccessFramework.readDirectoryAsync(folderUri);
        } catch (error) {
            console.error('Errore nel controllo dei permessi:', error);
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
