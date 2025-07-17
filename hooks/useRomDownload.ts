import * as FileSystem from 'expo-file-system';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useDownload } from '../contexts/DownloadContext';
import { Rom } from '../services/api';
import { usePlatformFolders } from './usePlatformFolders';
import { useRomFileSystem } from './useRomFileSystem';
import { useTranslation } from './useTranslation';
import { Platform } from '../services/api';

export interface RomDownloadError extends Error {
    type: 'already_downloaded' | 'no_folder' | 'folder_selection_failed' | 'download_failed';
    romName?: string;
    platformName?: string;
}

export const useRomDownload = () => {
    const { addToQueue, isDownloading } = useDownload();
    const { requestPlatformFolder, searchPlatformFolder, savePlatformFolder } = usePlatformFolders();
    const { checkIfRomExists, isRomDownloaded } = useRomFileSystem();
    const { t } = useTranslation();

    const downloadRom = useCallback(async (rom: Rom): Promise<string | null> => {
        // First check if the ROM is already downloaded (from cache)
        if (isRomDownloaded(rom.id)) {
            const error = new Error(t('romAlreadyExists', { name: rom.name || rom.fs_name })) as RomDownloadError;
            error.type = 'already_downloaded';
            error.romName = rom.name || rom.fs_name;
            throw error;
        }

        let platformFolder = await searchPlatformFolder({ name: rom.platform_name, slug: rom.platform_slug } as Platform);

        // If platform folder exists, do a real-time check for the file
        if (platformFolder) {
            try {
                const exists = await checkIfRomExists(rom);
                if (exists) {
                    console.warn('ROM already exists in the folder:', rom.fs_name);
                    return null; // ROM already exists, no need to download
                }
            } catch (error) {
                console.error('Error checking if ROM exists:', error);
                // Continue with download if check fails
            }
        } else {
            // If the platform folder is not configured, prompt the user to select one
            await requestPlatformFolder({name: rom.platform_name, slug: rom.platform_slug} as Platform);
            platformFolder = await searchPlatformFolder({ name: rom.platform_name, slug: rom.platform_slug } as Platform);

            if(!platformFolder) {
                const error = new Error(t('folderSelectionFailed', { platform: rom.platform_name })) as RomDownloadError;
                error.type = 'folder_selection_failed';
                error.platformName = rom.platform_name;
                throw error;
            }

        }

        // Add to download queue
        console.log('Adding ROM to folder:', platformFolder);
        const downloadId = addToQueue(rom, platformFolder);
        return downloadId;
    }, [addToQueue, searchPlatformFolder, savePlatformFolder, checkIfRomExists, isRomDownloaded, t]);

    const isRomDownloading = useCallback((romId: number): boolean => {
        return isDownloading(romId);
    }, [isDownloading]);

    return {
        downloadRom,
        isRomDownloading,
    };
};
