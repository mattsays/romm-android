import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { useStorageAccessFramework } from './useStorageAccessFramework';

export const useRomsFolder = () => {
    const [romsFolderUri, setRomsFolderUri] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { readDirectoryContents, checkDirectoryPermissions } = useStorageAccessFramework();

    // Carica la cartella delle ROMs al primo avvio
    useEffect(() => {
        loadRomsFolderInfo();
    }, []);

    const loadRomsFolderInfo = async () => {
        try {
            setLoading(true);
            const savedFolderUri = await AsyncStorage.getItem('romsFolderUri');

            if (savedFolderUri) {
                // Verifica se abbiamo ancora i permessi per questa cartella
                const hasPermissions = await checkDirectoryPermissions(savedFolderUri);
                if (hasPermissions) {
                    setRomsFolderUri(savedFolderUri);
                } else {
                    // Rimuovi la cartella salvata se non abbiamo più i permessi
                    await AsyncStorage.removeItem('romsFolderUri');
                    setRomsFolderUri(null);
                }
            }
        } catch (error) {
            console.error('Errore nel caricare la cartella delle ROMs:', error);
            setRomsFolderUri(null);
        } finally {
            setLoading(false);
        }
    };

    // Funzione per salvare una nuova cartella delle ROMs
    const saveRomsFolderUri = async (folderUri: string) => {
        try {
            console.log('Saving ROM folder URI:', folderUri);
            await AsyncStorage.setItem('romsFolderUri', folderUri);
            setRomsFolderUri(folderUri);
        } catch (error) {
            console.error('Errore nel salvare la cartella delle ROMs:', error);
            throw error;
        }
    };

    // Funzione per rimuovere la cartella delle ROMs
    const clearRomsFolderInfo = async () => {
        try {
            await AsyncStorage.removeItem('romsFolderUri');
            setRomsFolderUri(null);
        } catch (error) {
            console.error('Errore nella rimozione della cartella delle ROMs:', error);
            throw error;
        }
    };

    // Funzione per leggere il contenuto della cartella delle ROMs
    const readRomsDirectoryContents = async (): Promise<string[]> => {
        if (!romsFolderUri) {
            throw new Error('Nessuna cartella delle ROMs configurata');
        }

        try {
            return await readDirectoryContents(romsFolderUri);
        } catch (error) {
            console.error('Errore nella lettura del contenuto della cartella delle ROMs:', error);
            throw error;
        }
    };

    // Funzione per verificare se la cartella è ancora accessibile
    const checkRomsFolderAccess = async (): Promise<boolean> => {
        if (!romsFolderUri) {
            return false;
        }

        try {
            return await checkDirectoryPermissions(romsFolderUri);
        } catch (error) {
            console.error('Errore nel controllo dell\'accesso alla cartella delle ROMs:', error);
            return false;
        }
    };

    // Funzione per estrarre il nome della cartella dall'URI per la visualizzazione
    const extractFolderNameFromUri = (uri: string): string => {
        try {
            // Prova a decodificare l'URI per ottenere un nome leggibile
            const decodedUri = decodeURIComponent(uri);

            // Estrae l'ultima parte dell'URI come nome della cartella
            const parts = decodedUri.split('/');
            const lastPart = parts[parts.length - 1];

            // Se l'ultima parte contiene %3A, prova a pulirla
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
