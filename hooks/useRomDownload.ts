import * as FileSystem from 'expo-file-system';
import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useDownload } from '../contexts/DownloadContext';
import { Rom, RomFile, RomSibling } from '../services/api';
import { usePlatformFolders } from './usePlatformFolders';
import { useRomFileSystem } from './useRomFileSystem';
import { useTranslation } from './useTranslation';
import { Platform, apiClient } from '../services/api';

export interface RomDownloadError extends Error {
    type: 'already_downloaded' | 'no_folder' | 'folder_selection_failed' | 'download_failed';
    romName?: string;
    platformName?: string;
}

export const useRomDownload = () => {
    const { addRomToQueue, isRomDownloading } = useDownload();
    const { requestPlatformFolder, searchPlatformFolder, savePlatformFolder } = usePlatformFolders();
    const { checkIfRomExists, isRomDownloaded } = useRomFileSystem();
    const { t } = useTranslation();

    const downloadRom = useCallback(async (rom: Rom, romFile: RomFile, platform: Platform): Promise<string | null> => {
        // First check if the ROM is already downloaded (from cache)

        if (isRomDownloaded(romFile)) {
            const error = new Error(t('romAlreadyExists', { name: romFile.file_name })) as RomDownloadError;
            error.type = 'already_downloaded';
            error.romName = romFile.file_name;
            throw error;
        }

        console.log('Downloading ROM:', romFile.file_name);

        let platformFolder = await searchPlatformFolder(platform);

        // If platform folder exists, do a real-time check for the file
        if (platformFolder) {
            try {
                const exists = await checkIfRomExists(romFile, platformFolder);
                if (exists) {
                    console.warn('ROM already exists in the folder:', romFile.file_name);
                    return null; // ROM already exists, no need to download
                }
            } catch (error) {
                console.error('Error checking if ROM exists:', error);
                // Continue with download if check fails
            }
        } else {
            // If the platform folder is not configured, prompt the user to select one
            await requestPlatformFolder(platform);
            platformFolder = await searchPlatformFolder(platform);

            if(!platformFolder) {
                const error = new Error(t('folderSelectionFailed', { platform: platform.name })) as RomDownloadError;
                error.type = 'folder_selection_failed';
                error.platformName = platform.name;
                throw error;
            }

        }

        // Add to download queue
        console.log('Adding ROM to folder:', platformFolder);
        const downloadId = addRomToQueue(rom, romFile, platformFolder);
        return downloadId;
    }, [addRomToQueue, searchPlatformFolder, savePlatformFolder, checkIfRomExists, isRomDownloaded, t]);

    const isDownloading = useCallback((romFile: RomFile): boolean => {
        return isRomDownloading(romFile);
    }, [isRomDownloading]);

    return {
        downloadRom,
        isDownloading,
    };
};
