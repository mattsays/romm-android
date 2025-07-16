import * as FileSystem from 'expo-file-system';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useDownload } from '../contexts/DownloadContext';
import { Rom } from '../services/api';
import { usePlatformFolders } from './usePlatformFolders';
import { useRomFileSystem } from './useRomFileSystem';
import { useTranslation } from './useTranslation';

export const useRomDownload = () => {
    const { addToQueue, isDownloading, getDownloadById } = useDownload();
    const { getPlatformFolder, savePlatformFolder } = usePlatformFolders();
    const { checkIfRomExists, isRomDownloaded } = useRomFileSystem();
    const { t } = useTranslation();

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

    const downloadRom = useCallback(async (rom: Rom): Promise<string | null> => {
        // First check if the ROM is already downloaded (from cache)
        if (isRomDownloaded(rom.id)) {
            Alert.alert(
                t('fileAlreadyDownloaded'),
                t('romAlreadyExists', { name: rom.name || rom.fs_name }),
                [{ text: t('ok') }]
            );
            return null;
        }

        const platformSlug = rom.platform_slug;
        let platformFolder = await getPlatformFolder(platformSlug);

        // If platform folder exists, do a real-time check for the file
        if (platformFolder) {
            try {
                const exists = await checkIfRomExists(rom);
                if (exists) {
                    Alert.alert(
                        t('fileAlreadyDownloaded'),
                        t('romAlreadyExists', { name: rom.name || rom.fs_name }),
                        [{ text: t('ok') }]
                    );
                    return null;
                }
            } catch (error) {
                console.error('Error checking if ROM exists:', error);
                // Continue with download if check fails
            }
        }

        // If the platform folder is not configured, prompt the user to select one
        if (!platformFolder) {
            return new Promise((resolve) => {
                Alert.alert(
                    t('platformFolderTitle'),
                    t('platformFolderMessage', { platform: rom.platform_name }),
                    [
                        {
                            text: t('cancel'),
                            style: 'cancel',
                            onPress: () => resolve(null)
                        },
                        {
                            text: t('selectFolder'),
                            onPress: async () => {
                                try {
                                    const res = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                                    if (res.granted) {
                                        const folderUri = res.directoryUri;
                                        await savePlatformFolder(platformSlug, rom.platform_name, folderUri);

                                        const newPlatformFolder = {
                                            platformSlug,
                                            platformName: rom.platform_name,
                                            folderUri,
                                            folderName: extractFolderNameFromUri(folderUri)
                                        };

                                        // Add to download queue
                                        const downloadId = addToQueue(rom, newPlatformFolder);
                                        resolve(downloadId);
                                    } else {
                                        resolve(null);
                                    }
                                } catch (error) {
                                    console.error('Error selecting folder:', error);
                                    Alert.alert(
                                        t('error'),
                                        t('unableToSelectFolder'),
                                        [{ text: t('ok') }]
                                    );
                                    resolve(null);
                                }
                            }
                        }
                    ]
                );
            });
        }

        // Add to download queue
        const downloadId = addToQueue(rom, platformFolder);
        return downloadId;
    }, [addToQueue, getPlatformFolder, savePlatformFolder, checkIfRomExists, isRomDownloaded, t]);

    const isRomDownloading = useCallback((romId: number): boolean => {
        return isDownloading(romId);
    }, [isDownloading]);

    return {
        downloadRom,
        isRomDownloading,
    };
};
