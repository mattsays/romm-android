import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
import { useDownload } from '../../contexts/DownloadContext';
import { usePlatformFolders } from '../../hooks/usePlatformFolders';
import { useRomDownload } from '../../hooks/useRomDownload';
import { apiClient, Rom } from '../../services/api';

export default function GameDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const [rom, setRom] = useState<Rom | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAlreadyDownloaded, setIsAlreadyDownloaded] = useState(false);
    const [checkingExistingFile, setCheckingExistingFile] = useState(false);
    const [existingFilePath, setExistingFilePath] = useState<string | null>(null);
    const { downloadRom, isRomDownloading } = useRomDownload();
    const { getDownloadById } = useDownload();
    const {
        getPlatformFolder
    } = usePlatformFolders();

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
    }, [rom]); // Ricontrolla anche quando le cartelle delle piattaforme cambiano

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

        try {
            await downloadRom(rom);

        } catch (error) {
            console.error('Download error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Si è verificato un errore durante il download. Riprova più tardi.';
            Alert.alert(
                'Errore Download',
                errorMessage
            );
        }
    };

    const handleDeleteFile = async (rom: Rom) => {
        if (!existingFilePath) {
            Alert.alert('Errore', 'Nessun file da eliminare trovato');
            return;
        }

        Alert.alert(
            'Conferma eliminazione',
            `Sei sicuro di voler eliminare il file "${rom.name || rom.fs_name}"?\n\nQuesta azione non può essere annullata.`,
            [
                {
                    text: 'Annulla',
                    style: 'cancel',
                },
                {
                    text: 'Elimina',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setCheckingExistingFile(true);

                            // Try to delete the file using Storage Access Framework
                            const platformSlug = rom.platform_slug;
                            const platformFolder = await getPlatformFolder(platformSlug);

                            if (!platformFolder) {
                                throw new Error('Cartella della piattaforma non trovata');
                            }

                            // Get all files in the platform folder
                            const files = await FileSystem.StorageAccessFramework.readDirectoryAsync(
                                platformFolder.folderUri
                            );

                            // Find the file to delete
                            const fileToDelete = files.find(fileUri => {
                                const decodedUri = decodeURIComponent(fileUri);
                                const fileName = decodedUri.split('/').pop() || '';
                                return fileName === rom.fs_name || fileName.includes(rom.fs_name.split('.')[0]);
                            });

                            if (fileToDelete) {
                                await FileSystem.StorageAccessFramework.deleteAsync(fileToDelete);

                                // Update the state to reflect that the file is no longer downloaded
                                setIsAlreadyDownloaded(false);
                                setExistingFilePath(null);

                                Alert.alert(
                                    'File eliminato',
                                    'Il file è stato eliminato con successo'
                                );
                            } else {
                                throw new Error('File non trovato');
                            }
                        } catch (error) {
                            console.error('Error deleting file:', error);
                            const errorMessage = error instanceof Error ? error.message : 'Errore durante l\'eliminazione del file';
                            Alert.alert(
                                'Errore',
                                `Non è stato possibile eliminare il file: ${errorMessage}`
                            );
                        } finally {
                            setCheckingExistingFile(false);
                        }
                    },
                },
            ]
        );
    };

    const checkIfFileAlreadyExists = async (rom: Rom): Promise<void> => {
        // Controlla se ci sono file e se il primo file ha un hash MD5
        if (!rom.files || rom.files.length === 0 || !rom.files[0].md5_hash) {
            console.log('Nessun hash MD5 disponibile per questa ROM');
            setIsAlreadyDownloaded(false);
            return;
        }

        const platformSlug = rom.platform_slug;
        const platformFolder = await getPlatformFolder(platformSlug);

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
                        setIsAlreadyDownloaded(true);
                        setExistingFilePath(decodedUri);
                        return;
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
                                            disabled={isRomDownloading(rom.id)}
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
                                        <TouchableOpacity
                                            style={[styles.downloadButton, styles.deleteButton]}
                                            onPress={() => handleDeleteFile(rom)}
                                        >
                                            <Ionicons name="trash-outline" size={20} color="#fff" />
                                            <Text style={styles.downloadButtonText}>Elimina</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={[
                                        styles.downloadButton,
                                        isRomDownloading(rom.id) && styles.downloadingButton
                                    ]}
                                    onPress={handleDownload}
                                    disabled={isRomDownloading(rom.id)}
                                >
                                    {isRomDownloading(rom.id) ? (
                                        <View style={styles.downloadingContent}>
                                            <ActivityIndicator size="small" color="#fff" />
                                            <Text style={styles.downloadButtonText}>
                                                Aggiunto alla coda
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
        flexWrap: 'wrap',
        gap: 8,
    },
    redownloadButton: {
        backgroundColor: '#FF9500',
        minWidth: '30%',
        flex: 1,
    },
    verifyButton: {
        backgroundColor: '#007AFF',
        minWidth: '30%',
        flex: 1,
    },
    deleteButton: {
        backgroundColor: '#FF3B30',
        minWidth: '30%',
        flex: 1,
    },
});