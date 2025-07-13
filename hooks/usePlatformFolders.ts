import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { useStorageAccessFramework } from './useStorageAccessFramework';

export interface PlatformFolder {
    platformSlug: string;
    platformName: string;
    folderUri: string;
    folderName: string;
}

export const usePlatformFolders = () => {
    const [platformFolders, setPlatformFolders] = useState<Record<string, PlatformFolder>>({});
    const [loading, setLoading] = useState(true);
    const { checkDirectoryPermissions } = useStorageAccessFramework();

    const STORAGE_KEY = 'platformFolders';

    // Load platform folders from AsyncStorage when the hook is initialized
    useEffect(() => {
        loadPlatformFolders();
    }, []);


    const loadPlatformFolders = async () => {
        try {
            setLoading(true);
            const savedFolders = await AsyncStorage.getItem(STORAGE_KEY);

            if (savedFolders) {
                const parsedFolders: Record<string, PlatformFolder> = JSON.parse(savedFolders);

                // Check permissions for each folder
                const validFolders: Record<string, PlatformFolder> = {};

                for (const [platformSlug, folderData] of Object.entries(parsedFolders)) {
                    try {
                        const hasPermissions = await checkDirectoryPermissions(folderData.folderUri);
                        if (hasPermissions) {
                            validFolders[platformSlug] = folderData;
                        } else {
                            console.warn(`Permissions lost for platform ${platformSlug}`);
                        }
                    } catch (error) {
                        console.warn(`Error checking permissions for platform ${platformSlug}:`, error);
                    }
                }

                setPlatformFolders(validFolders);

                // If the number of valid folders is different from the saved ones, update storage
                if (Object.keys(validFolders).length !== Object.keys(parsedFolders).length) {
                    await savePlatformFoldersToStorage(validFolders);
                }
            }
        } catch (error) {
            console.error('Error loading platform folders:', error);
            setPlatformFolders({});
        } finally {
            setLoading(false);
        }
    };

    const savePlatformFoldersToStorage = async (folders: Record<string, PlatformFolder>) => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
        } catch (error) {
            console.error('Errore nel salvare le cartelle delle piattaforme:', error);
            throw error;
        }
    };

    // Function to save a folder for a specific platform
    const savePlatformFolder = async (
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

            const updatedFolders = {
                ...platformFolders,
                [platformSlug]: newFolder
            };

            await savePlatformFoldersToStorage(updatedFolders);
            setPlatformFolders(updatedFolders);
            console.log(`Cartella per la piattaforma ${platformSlug} salvata con successo:`, newFolder);
            console.log('Cartelle aggiornate:', updatedFolders);
        } catch (error) {
            console.error(`Errore nel salvare la cartella per la piattaforma ${platformSlug}:`, error);
            throw error;
        }
    };

    // Function to remove a platform folder
    const removePlatformFolder = async (platformSlug: string) => {
        try {
            const updatedFolders = { ...platformFolders };
            delete updatedFolders[platformSlug];

            await savePlatformFoldersToStorage(updatedFolders);
            setPlatformFolders(updatedFolders);
        } catch (error) {
            console.error(`Errore nella rimozione della cartella per la piattaforma ${platformSlug}:`, error);
            throw error;
        }
    };

    // Function to get the folder for a specific platform
    const getPlatformFolder = (platformSlug: string): PlatformFolder | null => {
        return platformFolders[platformSlug] || null;
    };

    // Function to check if a platform has a configured folder
    const hasPlatformFolder = (platformSlug: string): boolean => {
        return !!platformFolders[platformSlug];
    };

    // Function to check if a platform's folder is still accessible
    const checkPlatformFolderAccess = async (platformSlug: string): Promise<boolean> => {
        const folder = platformFolders[platformSlug];
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

    // Funzione per ottenere tutte le piattaforme configurate
    const getAllConfiguredPlatforms = (): PlatformFolder[] => {
        return Object.values(platformFolders);
    };

    // Funzione per pulire tutte le cartelle delle piattaforme
    const clearAllPlatformFolders = async () => {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY);
            setPlatformFolders({});
        } catch (error) {
            console.error('Errore nella rimozione di tutte le cartelle delle piattaforme:', error);
            throw error;
        }
    };

    return {
        platformFolders,
        loading,
        loadPlatformFolders,
        savePlatformFolder,
        removePlatformFolder,
        getPlatformFolder,
        hasPlatformFolder,
        checkPlatformFolderAccess,
        getAllConfiguredPlatforms,
        clearAllPlatformFolders,
    };
};
