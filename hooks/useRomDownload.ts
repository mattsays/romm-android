import * as FileSystem from 'expo-file-system';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useDownload } from '../contexts/DownloadContext';
import { Rom } from '../services/api';
import { usePlatformFolders } from './usePlatformFolders';

export const useRomDownload = () => {
    const { addToQueue, isDownloading, getDownloadById } = useDownload();
    const { getPlatformFolder, savePlatformFolder } = usePlatformFolders();

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
        const platformSlug = rom.platform_slug;
        let platformFolder = await getPlatformFolder(platformSlug);

        // If the platform folder is not configured, prompt the user to select one
        if (!platformFolder) {
            return new Promise((resolve) => {
                Alert.alert(
                    'Cartella Piattaforma',
                    `Non hai ancora configurato una cartella per la piattaforma "${rom.platform_name}". Seleziona una cartella dove salvare le ROM di questa piattaforma.`,
                    [
                        {
                            text: 'Annulla',
                            style: 'cancel',
                            onPress: () => resolve(null)
                        },
                        {
                            text: 'Seleziona Cartella',
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
                                    console.error('Errore nella selezione della cartella:', error);
                                    Alert.alert(
                                        'Errore',
                                        'Impossibile selezionare la cartella. Riprova.',
                                        [{ text: 'OK' }]
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
    }, [addToQueue, getPlatformFolder, savePlatformFolder]);

    const isRomDownloading = useCallback((romId: number): boolean => {
        return isDownloading(romId);
    }, [isDownloading]);

    return {
        downloadRom,
        isRomDownloading,
    };
};
