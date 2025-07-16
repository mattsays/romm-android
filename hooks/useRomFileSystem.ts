import * as FileSystem from 'expo-file-system';
import { useCallback, useMemo, useState } from 'react';
import { Rom } from '../services/api';
import { usePlatformFolders } from './usePlatformFolders';


interface RomHash {
    hash: string;
    lastModified: number;
}

export const useRomFileSystem = () => {
    const { getPlatformFolder } = usePlatformFolders();
    const [fileChecks, setFileChecks] = useState<Record<number, boolean>>({});
    const [checking, setChecking] = useState<Record<number, boolean>>({});

    const calculateFileMD5 = useCallback(async (fileUri: string): Promise<string | null> => {
        try {
            const fileStat = await FileSystem.getInfoAsync(fileUri, { md5: true });

            if (!fileStat.exists || !fileStat.md5) {
                console.warn(`File not found or MD5 not available for: ${fileUri}`);
                return null;
            }

            return fileStat.md5;
        } catch (error) {
            console.error('Error calculating MD5:', error);
            throw error;
        }
    }, []);

    const checkIfRomExists = useCallback(async (rom: Rom): Promise<boolean> => {
        // Check if there are files and if the first file has an MD5 hash
        if (!rom.files || rom.files.length === 0 || !rom.files[0].md5_hash) {
            console.log('No MD5 hash available for this ROM');
            return false;
        }

        const platformSlug = rom.platform_slug;
        const platformFolder = await getPlatformFolder(platformSlug);

        if (!platformFolder) {
            return false;
        }

        try {
            setChecking(prev => ({ ...prev, [rom.id]: true }));

            // Read all files in the platform folder
            const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(
                platformFolder.folderUri
            );

            const expectedMD5 = rom.files[0].md5_hash;

            // Check each file to see if it matches our MD5 hash
            for (const fileUri of files) {
                try {
                    // Check if the file name matches what we're looking for
                    const decodedUri = decodeURIComponent(fileUri);
                    const fileName = decodedUri.split('/').pop() || '';

                    // If the file name matches, calculate the MD5
                    if (fileName === rom.fs_name || fileName.includes(rom.fs_name.split('.')[0])) {
                        console.log(`Checking MD5 of file: ${fileName}`);

                        const fileMD5 = await calculateFileMD5(fileUri);
                        console.log(`Calculated MD5: ${fileMD5}`);
                        console.log(`Expected MD5: ${expectedMD5}`);

                        if (fileMD5 === expectedMD5) {
                            console.log('Already downloaded file found!');
                            const exists = true;
                            setFileChecks(prev => ({ ...prev, [rom.id]: exists }));
                            return exists;
                        }
                    }
                } catch (fileError) {
                    console.warn(`Error checking file ${fileUri}:`, fileError);
                    // Continue checking other files even if one fails
                }
            }

            console.log('File not found in folder');
            const exists = false;
            setFileChecks(prev => ({ ...prev, [rom.id]: exists }));
            return exists;

        } catch (error) {
            console.error('Error checking existing files:', error);
            const exists = false;
            setFileChecks(prev => ({ ...prev, [rom.id]: exists }));
            return exists;
        } finally {
            setChecking(prev => ({ ...prev, [rom.id]: false }));
        }
    }, [getPlatformFolder, calculateFileMD5]);

    const isRomDownloaded = useCallback((romId: number): boolean => {
        // console.log('Controllo se ROM è scaricata:', romId);
        // console.log('Nome della ROM:', romId);
        // console.log('File checks:', fileChecks);
        // console.log('Checking state:', fileChecks[romId] || false);
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

        var files = await FileSystem.StorageAccessFramework.readDirectoryAsync(
            platformFolderUri
        );

        for (const rom of romsToCheck) {
            for (const fileUri of files) {
                if (decodeURIComponent(fileUri).includes(rom.fs_name)) {
                    setFileChecks(prev => ({ ...prev, [rom.id]: true }));
                    files = files.filter(f => f !== fileUri); // Remove file from the list of files to check
                    break; // No need to check further files for this ROM
                }
            }
        }

    }, [checkIfRomExists, fileChecks, checking]);

    const refreshRomCheck = useCallback(async (rom: Rom): Promise<boolean> => {
        // Force refresh by removing from cache
        setFileChecks(prev => {
            const newChecks = { ...prev };
            delete newChecks[rom.id];
            return newChecks;
        });
        return await checkIfRomExists(rom);
    }, [checkIfRomExists]);

    const memoizedReturn = useMemo(() => ({
        checkIfRomExists,
        isRomDownloaded,
        isCheckingRom,
        checkMultipleRoms,
        refreshRomCheck,
        fileChecks,
        checking
    }), [
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
