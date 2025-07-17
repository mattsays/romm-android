import * as SAF from '@joplin/react-native-saf-x';
import * as FileSystem from 'expo-file-system';
import { useCallback, useMemo, useState } from 'react';
import { Platform, Rom } from '../services/api';
import { usePlatformFolders } from './usePlatformFolders';


interface RomHash {
    hash: string;
    lastModified: number;
}

export const useRomFileSystem = () => {
    const { searchPlatformFolder } = usePlatformFolders();
    const [fileChecks, setFileChecks] = useState<Record<number, boolean>>({});
    const [checking, setChecking] = useState<Record<number, boolean>>({});

    const checkIfRomExists = useCallback(async (rom: Rom): Promise<boolean> => {
        // Check if there are files
        if (!rom.files || rom.files.length === 0) {
            console.log('No files available for this ROM');
            return false;
        }

        const platformSlug = rom.platform_slug;
        const platformFolder = await searchPlatformFolder({ name: rom.platform_name, slug: platformSlug } as Platform);

        if (!platformFolder) {
            return false;
        }

        try {
            // Read all files in the platform folder
            const romExists = await SAF.exists(
                platformFolder.folderUri + '/' + rom.fs_name
            );

            if (romExists) {
                console.log('ROM already exists in the folder:', rom.fs_name);
                setFileChecks(prev => ({ ...prev, [rom.id]: true }));
                return true;
            }

            setFileChecks(prev => ({ ...prev, [rom.id]: false }));
            return false;

        } catch (error) {
            console.error('Error checking existing files:', error);
            const exists = false;
            setFileChecks(prev => ({ ...prev, [rom.id]: exists }));
            return exists;
        }


    }, [searchPlatformFolder]);

    const isRomDownloaded = useCallback((romId: number): boolean => {
        return fileChecks[romId] || false;
    }, [fileChecks]);

    const isCheckingRom = useCallback((romId: number): boolean => {
        return checking[romId] || false;
    }, [checking]);

    const checkMultipleRoms = useCallback(async (roms: Rom[], platformFolderUri: string): Promise<void> => {
        // Only check ROMs that haven't been checked yet
        const romsToCheck = roms.filter(rom =>
            fileChecks[rom.id] === undefined && !checking[rom.id]
        );

        if (romsToCheck.length === 0) {
            return;
        }

        // list all files in the platform folder
        if (!platformFolderUri) {
            console.warn('No platform folder configured for:', romsToCheck[0].platform_slug);
            return;
        }

        for (const rom of romsToCheck) {
            await checkIfRomExists(rom);
        }

    }, [checkIfRomExists, fileChecks, checking]);

    const refreshRomCheck = useCallback(async (rom: Rom): Promise<boolean> => {
        if(fileChecks[rom.id] == true) {
            // If already checked and exists, return true
            return true;
        }

        return await checkIfRomExists(rom);
    }, [checkIfRomExists]);

    const resetRomsCheck = useCallback((roms: Rom[]) => {
        roms.forEach((rom, _) => {
            setFileChecks(prev => ({ ...prev, [rom.id]: false }));
            setChecking(prev => ({ ...prev, [rom.id]: false }));
        });
    }, []);

    const memoizedReturn = useMemo(() => ({
        resetRomsCheck,
        checkIfRomExists,
        isRomDownloaded,
        isCheckingRom,
        checkMultipleRoms,
        refreshRomCheck,
        fileChecks,
        checking
    }), [
        resetRomsCheck,
        checkIfRomExists,
        isRomDownloaded,
        isCheckingRom,
        checkMultipleRoms,
        refreshRomCheck,
        fileChecks,
        checking
    ]);

    return memoizedReturn;
};
