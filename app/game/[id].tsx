import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { PlatformFolder, usePlatformFolders } from '../../hooks/usePlatformFolders';
import { apiClient, Rom } from '../../services/api';

export default function GameDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [rom, setRom] = useState<Rom | null>(null);
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [isAlreadyDownloaded, setIsAlreadyDownloaded] = useState(false);
    const [checkingExistingFile, setCheckingExistingFile] = useState(false);
    const [existingFilePath, setExistingFilePath] = useState<string | null>(null);
    const {
        getPlatformFolder,
        hasPlatformFolder,
        savePlatformFolder,
        platformFolders
    } = usePlatformFolders();

    // Funzione per estrarre il nome della cartella dall'URI
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

    useEffect(() => {
        if (id) {
            loadRomDetails();
        }
    }, [id]);

    // Controlla se il file è già stato scaricato quando la ROM è caricata
    useEffect(() => {
        if (rom) {
            checkIfFileAlreadyExists(rom);
        }
    }, [rom, platformFolders]); // Ricontrolla anche quando le cartelle delle piattaforme cambiano

    const loadRomDetails = async () => {
        try {
            setLoading(true);
            setError(null);
            const romData = await apiClient.getRomById(parseInt(id));
            setRom(romData);
        } catch (error) {
            console.error('Error loading ROM details:', error);
            setError('Errore nel caricamento dei dettagli del gioco');
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        router.back();
    };

    const handleDownload = async () => {
        if (!rom) return;

        const platformSlug = rom.platform_slug;
        let platformFolder = getPlatformFolder(platformSlug);

        

        // If the platform folder is not configured, prompt the user to select one
        if (!platformFolder) {
            Alert.alert(
                'Cartella Piattaforma',
                `Non hai ancora configurato una cartella per la piattaforma "${rom.platform_name}". Seleziona una cartella dove salvare le ROM di questa piattaforma.`,
                [
                    { text: 'Annulla', style: 'cancel' },
                    {
                        text: 'Seleziona Cartella',
                        onPress: async () => {
                            try {
                                const res = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                                if (res.granted) {
                                    const folderUri = res.directoryUri;
                                    await savePlatformFolder(platformSlug, rom.platform_name, folderUri);
                                    console.log(`Cartella configurata per ${rom.platform_name}:`, folderUri);
                                    // Create the platformFolder object manually for immediate download
                                    const newPlatformFolder = {
                                        platformSlug,
                                        platformName: rom.platform_name,
                                        folderUri,
                                        folderName: extractFolderNameFromUri(folderUri)
                                    };

                                    // Perform the download with the new platform folder
                                    await performDownload(newPlatformFolder);
                                }
                            } catch (error) {
                                console.error('Errore nella selezione della cartella:', error);
                                Alert.alert(
                                    'Errore',
                                    'Impossibile selezionare la cartella. Riprova.',
                                    [{ text: 'OK' }]
                                );
                            }
                        }
                    }
                ]
            );
            return;
        }

        await performDownload();
    };

    const performDownload = async (providedPlatformFolder?: PlatformFolder) => {
        if (!rom) return;

        const platformSlug = rom.platform_slug;
        const platformFolder = providedPlatformFolder || getPlatformFolder(platformSlug);
        console.log('Platform Folder:', platformFolder);
        if (!platformFolder) {
            Alert.alert(
                'Errore',
                'Cartella piattaforma non configurata',
                [{ text: 'OK' }]
            );
            return;
        }

        try {
            setDownloading(true);
            setDownloadProgress(0);

            // Get the download URL from the API
            const downloadUrl = await apiClient.obtainDownloadLink(rom);
            const fileName = rom.fs_name;
            await downloadRomFile(downloadUrl, fileName, platformFolder);

        } catch (error) {
            console.error('Download error:', error);
            setDownloading(false);
            setDownloadProgress(0);
            const errorMessage = error instanceof Error ? error.message : 'Si è verificato un errore durante il download. Riprova più tardi.';
            Alert.alert(
                'Errore Download',
                errorMessage
            );
        }
    };

    const downloadRomFile = async (
        downloadUrl: string,
        fileName: string,
        platformFolder: PlatformFolder
    ) => {
        const tempUri = FileSystem.cacheDirectory + fileName;

        // Download with progress tracking
        const downloadResumable = FileSystem.createDownloadResumable(
            downloadUrl,
            tempUri,
            {
                headers: apiClient.getAuthHeaders(),
            },
            (downloadProgress) => {
                const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
                setDownloadProgress(Math.round(progress * 100));
            }
        );

        const result = await downloadResumable.downloadAsync();

        if (result) {
            if (result.status !== 200) {
                throw new Error(`Download failed with status ${result.status}`);
            }

            setDownloadProgress(100);

            console.log("Platform Directory URI:", platformFolder.folderUri);

            // Create the file in the platform folder using Storage Access Framework
            const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                platformFolder.folderUri,
                fileName,
                'application/octet-stream'
            );

            // Using ReactNativeBlobUtil to write the file using MediaStore android api
            await ReactNativeBlobUtil.MediaCollection.writeToMediafile(
                fileUri,
                tempUri
            );

            // Delete the temporary file
            await FileSystem.deleteAsync(tempUri, { idempotent: true });

            console.log('File saved to SAF location:', decodeURIComponent(fileUri));

            setDownloading(false);
            setDownloadProgress(0);

            Alert.alert(
                'Download Completato',
                `${fileName} è stato scaricato con successo nella cartella di ${rom?.platform_name}!`,
                [{
                    text: 'OK',
                    style: 'default',
                    onPress: () => {
                        // Ricontrolla se il file è presente dopo il download
                        if (rom) {
                            checkIfFileAlreadyExists(rom);
                        }
                    }
                }]
            );
        }
    };
    
    const calculateFileMD5 = async (fileUri: string): Promise<string> => {
        try {
            const hash = await ReactNativeBlobUtil.fs.hash(fileUri, 'md5');
            return hash;
        } catch (error) {
            console.error('Errore nel calcolo MD5:', error);
            throw error;
        }
    };

    const checkIfFileAlreadyExists = async (rom: Rom): Promise<void> => {
            // Controlla se ci sono file e se il primo file ha un hash MD5
        if (!rom.files || rom.files.length === 0 || !rom.files[0].md5_hash) {
            console.log('Nessun hash MD5 disponibile per questa ROM');
            setIsAlreadyDownloaded(false);
            return;
        }

        const platformSlug = rom.platform_slug;
        const platformFolder = getPlatformFolder(platformSlug);

        if (!platformFolder) {
            setIsAlreadyDownloaded(false);
            return;
        }

        try {
            setCheckingExistingFile(true);
            console.log('Controllo se il file esiste già...');

            // Read all files in the platform folder
            const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(
                platformFolder.folderUri
            );

            console.log(`Trovati ${files.length} file nella cartella ${platformFolder.platformName}`);

            const expectedMD5 = rom.files[0].md5_hash;

            // Check each file to see if it matches our MD5 hash
            for (const fileUri of files) {
                try {
                    // Check if the file name matches what we're looking for
                    const decodedUri = decodeURIComponent(fileUri);
                    const fileName = decodedUri.split('/').pop() || '';

                    // If the file name matches, calculate the MD5
                    if (fileName === rom.fs_name || fileName.includes(rom.fs_name.split('.')[0])) {
                        console.log(`Controllo MD5 del file: ${fileName}`);

                        const fileMD5 = await calculateFileMD5(fileUri);
                        console.log(`MD5 calcolato: ${fileMD5}`);
                        console.log(`MD5 atteso: ${expectedMD5}`);

                        if (fileMD5 === expectedMD5) {
                            console.log('File già scaricato trovato!');
                            setIsAlreadyDownloaded(true);
                            setExistingFilePath(decodedUri);
                            return;
                        }
                    }
                } catch (fileError) {
                    console.warn(`Errore nel controllo del file ${fileUri}:`, fileError);
                    // Continue checking other files even if one fails
                }
            }

            console.log('File non trovato nella cartella');
            setIsAlreadyDownloaded(false);
            setExistingFilePath(null);

        } catch (error) {
            console.error('Errore nel controllo dei file esistenti:', error);
            setIsAlreadyDownloaded(false);
            setExistingFilePath(null);
        } finally {
            setCheckingExistingFile(false);
        }
    };

    if (loading) {
        return (
            <ProtectedRoute>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>Caricamento...</Text>
                </View>
            </ProtectedRoute>
        );
    }

    if (error || !rom) {
        return (
            <ProtectedRoute>
                <View style={styles.centered}>
                    <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
                    <Text style={styles.errorText}>
                        {error || 'Gioco non trovato'}
                    </Text>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <Text style={styles.backButtonText}>Torna indietro</Text>
                    </TouchableOpacity>
                </View>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <ScrollView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.title}>Dettagli Gioco</Text>
                </View>

                <View style={styles.content}>
                    {rom.url_cover && (
                        <Image
                            source={{ uri: rom.url_cover }}
                            style={styles.coverImage}
                            resizeMode="contain"
                        />
                    )}

                    <View style={styles.gameInfo}>
                        <Text style={styles.gameName}>{rom.name || rom.fs_name}</Text>
                        <Text style={styles.platformName}>{rom.platform_name}</Text>

                        {rom.summary && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>Descrizione</Text>
                                <Text style={styles.summary}>{rom.summary}</Text>
                            </View>
                        )}

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Informazioni</Text>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Dimensione:</Text>
                                <Text style={styles.infoValue}>
                                    {(rom.fs_size_bytes / (1024 * 1024)).toFixed(2)} MB
                                </Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>Piattaforma:</Text>
                                <Text style={styles.infoValue}>{rom.platform_name}</Text>
                            </View>
                        </View>

                        {/* Download Section */}
                        <View style={styles.section}>
                            {checkingExistingFile ? (
                                <View style={styles.checkingContainer}>
                                    <ActivityIndicator size="small" color="#007AFF" />
                                    <Text style={styles.checkingText}>Controllo file esistenti...</Text>
                                </View>
                            ) : isAlreadyDownloaded ? (
                                <View style={styles.alreadyDownloadedContainer}>
                                    <View style={styles.alreadyDownloadedHeader}>
                                        <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                                        <Text style={styles.alreadyDownloadedTitle}>File già scaricato</Text>
                                    </View>
                                    <Text style={styles.alreadyDownloadedPath}>
                                        Percorso: {existingFilePath}
                                    </Text>
                                    <View style={styles.alreadyDownloadedActions}>
                                        <TouchableOpacity
                                            style={[styles.downloadButton, styles.redownloadButton]}
                                            onPress={handleDownload}
                                            disabled={downloading}
                                        >
                                            <Ionicons name="download-outline" size={20} color="#fff" />
                                            <Text style={styles.downloadButtonText}>Riscarica</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.downloadButton, styles.verifyButton]}
                                            onPress={() => checkIfFileAlreadyExists(rom)}
                                        >
                                            <Ionicons name="refresh-outline" size={20} color="#fff" />
                                            <Text style={styles.downloadButtonText}>Verifica</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.downloadButton, downloading && styles.downloadingButton]}
                                    onPress={handleDownload}
                                    disabled={downloading}
                                >
                                    {downloading ? (
                                        <View style={styles.downloadingContent}>
                                            <ActivityIndicator size="small" color="#fff" />
                                            <Text style={styles.downloadButtonText}>
                                                Download in corso... {downloadProgress}%
                                            </Text>
                                        </View>
                                    ) : (
                                        <View style={styles.downloadContent}>
                                            <Ionicons name="download-outline" size={20} color="#fff" />
                                            <Text style={styles.downloadButtonText}>Scarica ROM</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            )}

                            {downloading && (
                                <View style={styles.progressContainer}>
                                    <View style={styles.progressBar}>
                                        <View
                                            style={[styles.progressFill, { width: `${downloadProgress}%` }]}
                                        />
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </ScrollView>
        </ProtectedRoute>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        padding: 20,
    },
    loadingText: {
        color: '#fff',
        fontSize: 16,
        marginTop: 10,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 20,
    },
    backButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    backBtn: {
        marginRight: 16,
        padding: 8,
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        padding: 20,
    },
    coverImage: {
        width: '100%',
        height: 300,
        borderRadius: 12,
        marginBottom: 20,
    },
    gameInfo: {
        flex: 1,
    },
    gameName: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    platformName: {
        color: '#ccc',
        fontSize: 16,
        marginBottom: 20,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    summary: {
        color: '#ccc',
        fontSize: 14,
        lineHeight: 20,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    infoLabel: {
        color: '#ccc',
        fontSize: 14,
    },
    infoValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    downloadButton: {
        backgroundColor: '#5f43b2',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
    },
    downloadingButton: {
        backgroundColor: '#666',
    },
    downloadContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    downloadingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    downloadButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    progressContainer: {
        marginTop: 12,
    },
    progressBar: {
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#5f43b2',
        borderRadius: 2,
    },
    checkingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#111',
        borderRadius: 12,
        gap: 8,
    },
    checkingText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '500',
    },
    alreadyDownloadedContainer: {
        backgroundColor: '#1a2e1a',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#34C759',
    },
    alreadyDownloadedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    alreadyDownloadedTitle: {
        color: '#34C759',
        fontSize: 16,
        fontWeight: 'bold',
    },
    alreadyDownloadedPath: {
        color: '#ccc',
        fontSize: 12,
        marginBottom: 12,
        lineHeight: 16,
    },
    alreadyDownloadedActions: {
        flexDirection: 'row',
        gap: 8,
    },
    redownloadButton: {
        backgroundColor: '#FF9500',
        flex: 1,
    },
    verifyButton: {
        backgroundColor: '#007AFF',
        flex: 1,
    },
});