import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useStorageAccessFramework } from './useStorageAccessFramework';


export const useRomsFolder = () => {
    const [romsFolderUri, setRomsFolderUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { readDirectoryContents, checkDirectoryPermissions } = useStorageAccessFramework();

    // Load ROMs folder on first launch
    useEffect(() => {
        loadRomsFolderInfo();
    }, []);

    const loadRomsFolderInfo = async () => {
        try {
            setLoading(true);
            const savedFolderUri = await AsyncStorage.getItem('romsFolderUri');

            if (savedFolderUri) {
                // Check if we still have permissions for this folder
                const hasPermissions = await checkDirectoryPermissions(savedFolderUri);
                if (hasPermissions) {
                    setRomsFolderUri(savedFolderUri);
                } else {
                    // Remove saved folder if we no longer have permissions
                    await AsyncStorage.removeItem('romsFolderUri');
                    setRomsFolderUri(null);
                }
            }
        } catch (error) {
            console.error('Error loading ROMs folder:', error);
            setRomsFolderUri(null);
        } finally {
            setLoading(false);
        }
    };

    // Function to save a new ROMs folder
    const saveRomsFolderUri = async (folderUri: string) => {
        try {
            console.log('Saving ROM folder URI:', folderUri);
            await AsyncStorage.setItem('romsFolderUri', folderUri);
            setRomsFolderUri(folderUri);
        } catch (error) {
            console.error('Error saving ROMs folder:', error);
            throw error;
        }
    };

    // Function to remove ROMs folder
    const clearRomsFolderInfo = async () => {
        try {
            await AsyncStorage.removeItem('romsFolderUri');
            setRomsFolderUri(null);
        } catch (error) {
            console.error('Error removing ROMs folder:', error);
            throw error;
        }
    };

    // Function to read ROMs folder contents
    const readRomsDirectoryContents = async (): Promise<string[]> => {
        if (!romsFolderUri) {
            throw new Error('No ROMs folder configured');
        }

        try {
            if (Platform.OS === 'android') {
                return await readDirectoryContents(romsFolderUri);
            } else {
                // For iOS, use expo-file-system
                return await FileSystem.readDirectoryAsync(romsFolderUri);
            }
        } catch (error) {
            console.error('Error reading ROMs folder contents:', error);
            throw error;
        }
    };

    // Function to check if folder is still accessible
    const checkRomsFolderAccess = async (): Promise<boolean> => {
        if (!romsFolderUri) {
            return false;
        }

        try {
            return await checkDirectoryPermissions(romsFolderUri);
        } catch (error) {
            console.error('Error checking ROMs folder access:', error);
            return false;
        }
    };

    // Function to extract folder name from URI for display
    const extractFolderNameFromUri = (uri: string): string => {
        try {
            // Try to decode URI to get a readable name
            const decodedUri = decodeURIComponent(uri);

            // Extract the last part of the URI as folder name
            const parts = decodedUri.split('/');
            const lastPart = parts[parts.length - 1];

            // If the last part contains %3A, try to clean it
            if (lastPart.includes('%3A')) {
                return lastPart.split('%3A').pop() || 'Selected Folder';
            }

            return lastPart || 'Selected Folder';
        } catch (error) {
            return 'Selected Folder';
        }
    };

    return {
        romsFolderUri,
        romsFolderName: romsFolderUri ? extractFolderNameFromUri(romsFolderUri) : null,
        loading,
        loadRomsFolderInfo,
        saveRomsFolderUri,
        clearRomsFolderInfo,
        readRomsDirectoryContents,
        checkRomsFolderAccess,
        hasRomsFolder: !!romsFolderUri,
    };
};
