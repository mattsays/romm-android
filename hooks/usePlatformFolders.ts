import * as SAF from '@joplin/react-native-saf-x';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { useStorageAccessFramework } from './useStorageAccessFramework';
import { useToast } from '@/contexts/ToastContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useRomFileSystem } from '@/hooks/useRomFileSystem';

import {
    Alert
} from 'react-native';
import { Platform } from '@/services/api';


export interface PlatformFolder {
    platformSlug: string;
    platformName: string;
    folderUri: string;
    folderName: string;
}

export const usePlatformFolders = () => {
    const { checkDirectoryPermissions, requestDirectoryPermissions } = useStorageAccessFramework();
    const [platformFolders, setPlatformFolders] = useState<PlatformFolder[]>([]);
    const { showSuccessToast, showErrorToast } = useToast();
    const { t } = useTranslation();

    const STORAGE_KEY = 'platformFolders';
    const STORAGE_KEY_BASE = 'platformFoldersBase';

    // // Load platform folders from AsyncStorage when the hook is initialized
    useEffect(() => {
        loadPlatformFolders();
    }, []);

    // Function to save a folder for a specific platform
    const savePlatformFolder = async (
        platformSlug: string,
        platformName: string,
        folderUri: string
    ): Promise<PlatformFolder | null> => {

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
            return newFolder;
        } catch (error) {
            console.error(`Error saving folder for platform ${platformSlug}:`, error);
            return null;
        }
    };

    const createPlatformFolder = async (
        platformSlug: string
    ): Promise<PlatformFolder | null> => {
        try {
            const baseFolder = await AsyncStorage.getItem(STORAGE_KEY_BASE);
            if (!baseFolder) {
                console.warn('No base folder configured for platform folders');
                return null;
            }
            const folderUri = `${baseFolder}/${platformSlug}`;

            // Create folder using SAF
            const folderRes = await SAF.mkdir(folderUri);

            if (!folderRes) {
                console.error(`Failed to create folder for platform ${platformSlug}`);
                return null;
            }

            const folderName = extractFolderNameFromUri(folderUri);
            const newFolder: PlatformFolder = {
                platformSlug,
                platformName: folderName,
                folderUri,
                folderName
            };

            await AsyncStorage.setItem(`${STORAGE_KEY}_${platformSlug}`, JSON.stringify(newFolder));
            return newFolder;
        } catch (error) {
            console.error(`Error creating folder for platform ${platformSlug}:`, error);
            return null;
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
            console.log('Loaded platform folders:', allFolders);
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

    const searchPlatformFolder = useCallback(
        async (platform: Platform): Promise<PlatformFolder | null> => {
            try {
                const folder = await getPlatformFolder(platform.slug);
                if (folder) {
                    return folder;
                } else {
                    // Try searching folder from base folder
                    const baseFolder = await AsyncStorage.getItem(STORAGE_KEY_BASE);

                    if (!baseFolder) {
                        console.warn('No base folder configured for platform folders');
                        return null;
                    }

                    const files = await SAF.listFiles(baseFolder);
                    for (const file of files) {
                        if (file.name.toLowerCase() === platform.slug || file.name.toLowerCase() === platform.name.toLowerCase()) {
                            return await savePlatformFolder(platform.fs_slug, platform.name, file.uri);
                        }
                    }
                }

                return null;
            } catch (error) {
                console.error(`Error searching for platform folder ${platform.slug}:`, error);
                throw error;
            }
        },
        [getPlatformFolder]
    );


    const requestPlatformFolder = useCallback(
        async (platform: Platform, force: boolean = false): Promise<void> => {

            const currentFolder = await searchPlatformFolder(platform);

            if(currentFolder && !force) {
                return;
            }

            Alert.alert(
                t('selectFolderTitle'),
                t('selectFolderToDownload', { platform: platform.name }),
                [
                    {
                        text: t('notNow'),
                        style: 'cancel'
                    },
                    {
                        text: t('selectFolder'),
                        onPress: async () => {
                            try {
                                const folderUri = await requestDirectoryPermissions();
                                if (folderUri) {
                                    console.log('Selected folder URI:', folderUri);
                                    const savedFolder = await savePlatformFolder(platform.slug, platform.name, folderUri);
                                    
                                    showSuccessToast(
                                        t('folderConfiguredSuccessfully', { platform: platform.name }),
                                        t('folderConfigured')
                                    );
                                }
                            } catch (error) {
                                console.error('Error selecting folder:', error);
                                showErrorToast(
                                    t('errorSelectingFolder'),
                                    t('error')
                                );
                            }
                        }
                    },
                    {
                        text: t('createFolder'),
                        onPress: async () => {
                            try {
                                await createPlatformFolder(platform.slug);
                            } catch (error) {
                                console.error('Error creating folder:', error);
                                showErrorToast(
                                    t('errorCreatingFolder'),
                                    t('error')
                                );
                            }
                        },
                    }
                ]
            );
        },
        [searchPlatformFolder]
    );

    // Function to set the base folder for all platforms
    const setBaseFolder = async (folderUri: string): Promise<void> => {
        try {
            await AsyncStorage.setItem(STORAGE_KEY_BASE, folderUri);
            console.log('Base folder set successfully:', folderUri);
        } catch (error) {
            console.error('Error setting base folder:', error);
            throw error;
        }
    };

    // Function to get the base folder
    const getBaseFolder = async (): Promise<string | null> => {
        try {
            return await AsyncStorage.getItem(STORAGE_KEY_BASE);
        } catch (error) {
            console.error('Error getting base folder:', error);
            return null;
        }
    };

    // Function to check if base folder is configured
    const hasBaseFolder = async (): Promise<boolean> => {
        const baseFolder = await getBaseFolder();
        return !!baseFolder;
    };

    // Function to remove the base folder
    const removeBaseFolder = async (): Promise<void> => {
        try {
            await AsyncStorage.removeItem(STORAGE_KEY_BASE);
            console.log('Base folder removed successfully');
        } catch (error) {
            console.error('Error removing base folder:', error);
            throw error;
        }
    };

    return {
        // loadPlatformFolders,
        requestPlatformFolder,
        createPlatformFolder,
        searchPlatformFolder,
        savePlatformFolder,
        removePlatformFolder,
        hasPlatformFolder,
        checkPlatformFolderAccess,
        loadPlatformFolders,
        platformFolders,
        setPlatformFolders,
        removeAllPlatformFolders,
        setBaseFolder,
        getBaseFolder,
        hasBaseFolder,
        removeBaseFolder,
    };
};
