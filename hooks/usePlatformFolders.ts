import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { useStorageAccessFramework } from './useStorageAccessFramework';

export interface PlatformFolder {
    platformSlug: string;
    platformName: string;
    folderUri: string;
    folderName: string;
}

export const usePlatformFolders = () => {
    const { checkDirectoryPermissions } = useStorageAccessFramework();
    const [platformFolders, setPlatformFolders] = useState<PlatformFolder[]>([]);

    const STORAGE_KEY = 'platformFolders';

    // // Load platform folders from AsyncStorage when the hook is initialized
    useEffect(() => {
        loadPlatformFolders();
    }, []);

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

            await AsyncStorage.setItem(`${STORAGE_KEY}_${platformSlug}`, JSON.stringify(newFolder));

            // Add folder to the list of configured platforms
            const allFolders = await AsyncStorage.getItem(STORAGE_KEY);
            const folders = allFolders ? JSON.parse(allFolders) : [];

            // Check if the folder already exists
            const existingIndex = folders.findIndex((folder: PlatformFolder) => folder.platformSlug === platformSlug);
            if (existingIndex !== -1) {
                // Update existing folder
                folders[existingIndex] = newFolder;
            } else {
                // Add new folder
                folders.push(newFolder);
            }
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(folders));

            console.log(`Folder for platform ${platformSlug} saved successfully:`, newFolder);
        } catch (error) {
            console.error(`Error saving folder for platform ${platformSlug}:`, error);
            throw error;
        }
    };

    // Function to remove a platform folder
    const removePlatformFolder = async (platformSlug: string) => {
        try {
            await AsyncStorage.removeItem(`${STORAGE_KEY}_${platformSlug}`);

            // Remove from the list of configured platforms
            const allFolders = await AsyncStorage.getItem(STORAGE_KEY);
            const folders = allFolders ? JSON.parse(allFolders) : [];
            const updatedFolders = folders.filter((folder: PlatformFolder) => folder.platformSlug !== platformSlug);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedFolders));
        } catch (error) {
            console.error(`Error removing folder for platform ${platformSlug}:`, error);
            throw error;
        }
    };

    // Function to remove all platform folders
    const removeAllPlatformFolders = async () => {
        try {
            const allFolders = await AsyncStorage.getItem(STORAGE_KEY);
            const folders = allFolders ? JSON.parse(allFolders) : [];

            // Remove each platform folder individually
            for (const folder of folders) {
                await AsyncStorage.removeItem(`${STORAGE_KEY}_${folder.platformSlug}`);
            }

            // Clear the main list
            await AsyncStorage.removeItem(STORAGE_KEY);

            // Update state
            setPlatformFolders([]);

            console.log('All platform folders removed successfully');
        } catch (error) {
            console.error('Error removing all platform folders:', error);
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
            console.error(`Error checking folder access for platform ${platformSlug}:`, error);
            return false;
        }
    };

    // Function to extract folder name from URI
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

    const loadPlatformFolders = useCallback(async () => {
        try {
            const allFolders = await AsyncStorage.getItem(STORAGE_KEY);
            if (allFolders) {
                setPlatformFolders(JSON.parse(allFolders));
            } else {
                setPlatformFolders([]);
            }
        } catch (error) {
            console.error('Error loading platform folders:', error);
            throw error;
        }
    }, []);

    return {
        // loadPlatformFolders,
        savePlatformFolder,
        removePlatformFolder,
        getPlatformFolder,
        hasPlatformFolder,
        checkPlatformFolderAccess,
        loadPlatformFolders,
        platformFolders,
        setPlatformFolders,
        removeAllPlatformFolders
    };
};
