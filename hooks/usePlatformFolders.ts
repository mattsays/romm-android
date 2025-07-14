import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useStorageAccessFramework } from './useStorageAccessFramework';

export interface PlatformFolder {
    platformSlug: string;
    platformName: string;
    folderUri: string;
    folderName: string;
}

export const usePlatformFolders = () => {
    const [loading, setLoading] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const { checkDirectoryPermissions } = useStorageAccessFramework();

    const STORAGE_KEY = 'platformFolders';

    // // Load platform folders from AsyncStorage when the hook is initialized
    // useEffect(() => {
    //     loadPlatformFolders()
    // }, []);


    const savePlatformFoldersToStorage = async (folders: Record<string, PlatformFolder>) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
        } catch (error) {
            console.error('Errore nel salvare le cartelle delle piattaforme:', error);
            throw error;
        }
    };

    // Function to save a folder for a specific platform
    const savePlatformFolder = async(
        platformSlug: string,
        platformName: string,
        folderUri: string
    ) => {

        try {
            const folderName = extractFolderNameFromUri(folderUri);
            const newFolder: PlatformFolder = {
                platformSlug,
                platformName,
                folderUri,
                folderName
            };

            await AsyncStorage.setItem(`${STORAGE_KEY}_${platformSlug}` , JSON.stringify(newFolder));
            
            console.log(`Cartella per la piattaforma ${platformSlug} salvata con successo:`, newFolder);
        } catch (error) {
            console.error(`Errore nel salvare la cartella per la piattaforma ${platformSlug}:`, error);
            throw error;
        } 
    };

    // Function to remove a platform folder
    const removePlatformFolder = async (platformSlug: string) => {
        try {
            await AsyncStorage.removeItem(`${STORAGE_KEY}_${platformSlug}`);
        } catch (error) {
            console.error(`Errore nella rimozione della cartella per la piattaforma ${platformSlug}:`, error);
            throw error;
        }
    };

    // Function to get the folder for a specific platform
    const getPlatformFolder = async (platformSlug: string): Promise<PlatformFolder | null> => {
        const folder = await AsyncStorage.getItem(`${STORAGE_KEY}_${platformSlug}`);
        return folder ? JSON.parse(folder) : null;
    };

    // Function to check if a platform has a configured folder
    const hasPlatformFolder = async (platformSlug: string): Promise<boolean> => {
        const folder = await getPlatformFolder(platformSlug);
        return !!folder;
    };

    // Function to check if a platform's folder is still accessible
    const checkPlatformFolderAccess = async (platformSlug: string): Promise<boolean> => {
        const folder = await getPlatformFolder(platformSlug);
        if (!folder) {
            return false;
        }

        try {
            return await checkDirectoryPermissions(folder.folderUri);
        } catch (error) {
            console.error(`Errore nel controllo dell'accesso alla cartella per la piattaforma ${platformSlug}:`, error);
            return false;
        }
    };

    // Funzione per estrarre il nome della cartella dall'URI
    const extractFolderNameFromUri = (uri: string): string => {
        try {
            const decodedUri = decodeURIComponent(uri);
            const parts = decodedUri.split('/');
            const lastPart = parts[parts.length - 1];

            if (lastPart.includes('%3A')) {
                return lastPart.split('%3A').pop() || 'Selected Folder';
            }

            return lastPart || 'Selected Folder';
        } catch (error) {
            return 'Selected Folder';
        }
    };

    // Funzione per attendere che i dati siano pronti
    const waitForReady = (): Promise<void> => {
        return new Promise((resolve) => {
            if (isReady) {
                resolve();
                return;
            }

            const checkReady = () => {
                if (isReady) {
                    resolve();
                } else {
                    setTimeout(checkReady, 50);
                }
            };

            checkReady();
        });
    };

    return {
        loading,
        isReady,
        // loadPlatformFolders,
        savePlatformFolder,
        removePlatformFolder,
        getPlatformFolder,
        hasPlatformFolder,
        checkPlatformFolderAccess,
        waitForReady,
    };
};
