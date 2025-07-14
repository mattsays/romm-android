import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useDownload } from '../../contexts/DownloadContext';
import { usePlatformFolders } from '../../hooks/usePlatformFolders';
import { useRomFileSystem } from '../../hooks/useRomFileSystem';
import { usePlatform, useRoms } from '../../hooks/useRoms';
import { useStorageAccessFramework } from '../../hooks/useStorageAccessFramework';
import { useTranslation } from '../../hooks/useTranslation';
import { apiClient, Rom } from '../../services/api';

const { width } = Dimensions.get('window');

export default function PlatformScreen() {
    const { platform } = useLocalSearchParams();
    const navigation = useNavigation();
    const { t } = useTranslation();
    const { roms, loading: romsLoading, error: romsError, fetchRomsByPlatform } = useRoms();
    const { platform: currentPlatform, loading: platformLoading, error: platformError, fetchPlatform } = usePlatform();
    const { addToQueue, isDownloading } = useDownload();
    const { getPlatformFolder, savePlatformFolder, hasPlatformFolder } = usePlatformFolders();
    const { checkMultipleRoms, isRomDownloaded, isCheckingRom } = useRomFileSystem();
    const { requestDirectoryPermissions } = useStorageAccessFramework();
    const [isDownloadingAll, setIsDownloadingAll] = useState(false);
    const [folderSelectionShown, setFolderSelectionShown] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const platformId = Number(platform);

    const selectedPlatform = currentPlatform?.name ||
        t(`platformNames.${currentPlatform?.slug as keyof typeof import('../../locales/it.json').platformNames}`) ||
        t('unknownPlatform');

    useEffect(() => {
        navigation.setOptions({
            title: selectedPlatform,
        });
    }, [navigation, selectedPlatform]);

    // Fetch platform data when platform ID is available
    useEffect(() => {
        if (platformId && !isNaN(platformId)) {
            fetchPlatform(platformId);
        }
    }, [platformId, fetchPlatform]);

    // Fetch ROMs when platform data is loaded
    useEffect(() => {
        console.log('Fetching ROMs for platform ID:', platformId);
        fetchRomsByPlatform(platformId);
    }, [platformId, fetchRomsByPlatform]);

    // Check filesystem for existing ROMs when ROMs are loaded
    useEffect(() => {
        const checkRomFolders = async () => {
            if (roms.length > 0) {
                if (currentPlatform) {
                    const folder = await getPlatformFolder(currentPlatform.slug);
                    checkMultipleRoms(roms, folder?.folderUri || '');
                }
            }
        };
        checkRomFolders();
    }, [roms, currentPlatform, checkMultipleRoms]);

    // // Check if platform folder is configured and request if not (only after ROMs are loaded)
    useEffect(() => {
        if (currentPlatform && roms.length > 0 && !folderSelectionShown) {
            const checkFolder = async () => {
                const hasFolder = await hasPlatformFolder(currentPlatform.slug);
                if (!hasFolder) {
                    setFolderSelectionShown(true);
                    await showFolderSelectionDialog();
                }
            };
            checkFolder();
        }
    }, [roms, currentPlatform, hasPlatformFolder]);

    const showFolderSelectionDialog = async () => {
        if (!currentPlatform) return;

        const hasFolder = await hasPlatformFolder(currentPlatform.slug);
        const currentFolder = await getPlatformFolder(currentPlatform.slug);

        Alert.alert(
            hasFolder ? 'Cambia Cartella' : 'Seleziona Cartella',
            hasFolder
                ? `Cartella attuale: ${currentFolder?.folderName}\n\nVuoi selezionare una nuova cartella per ${currentPlatform.name}?`
                : `Per scaricare le ROM di ${currentPlatform.name}, devi selezionare una cartella dove salvare i file.`,
            [
                {
                    text: hasFolder ? 'Annulla' : 'Non ora',
                    style: 'cancel'
                },
                {
                    text: hasFolder ? 'Cambia Cartella' : 'Seleziona Cartella',
                    onPress: async () => {
                        try {
                            const folderUri = await requestDirectoryPermissions();
                            if (folderUri) {
                                await savePlatformFolder(currentPlatform.slug, currentPlatform.name, folderUri);
                                Alert.alert(
                                    'Cartella Configurata',
                                    `Cartella configurata con successo per ${currentPlatform.name}!`
                                );
                            }
                        } catch (error) {
                            console.error('Error selecting folder:', error);
                            Alert.alert(
                                'Errore',
                                'Errore durante la selezione della cartella. Puoi riprovarci in seguito.',
                                [{ text: 'OK' }]
                            );
                        }
                    }
                }
            ]
        );
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            // Refresh both platform and ROMs data
            if (platformId && !isNaN(platformId)) {
                await Promise.all([
                    fetchPlatform(platformId),
                    fetchRomsByPlatform(platformId)
                ]);
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
            Alert.alert(
                'Errore',
                'Errore durante l\'aggiornamento dei dati. Riprova più tardi.',
                [{ text: 'OK' }]
            );
        } finally {
            setRefreshing(false);
        }
    };

    const handleDownloadAll = async () => {
        if (!currentPlatform || roms.length === 0) {
            Alert.alert('Errore', 'Nessuna ROM disponibile per il download.');
            return;
        }

        // Get the platform folder
        const platformFolder = await getPlatformFolder(currentPlatform.slug);
        if (!platformFolder) {
            Alert.alert(
                'Cartella non selezionata',
                `Per scaricare le ROM di ${currentPlatform.name}, devi prima selezionare una cartella.`,
                [
                    { text: 'Annulla', style: 'cancel' },
                    { text: 'Seleziona Cartella', onPress: () => showFolderSelectionDialog() }
                ]
            );
            return;
        }

        // Filter out ROMs that are already being downloaded or already exist on filesystem
        const romsToDownload = roms.filter(rom => !isDownloading(rom.id) && !isRomDownloaded(rom.id));

        if (romsToDownload.length === 0) {
            Alert.alert('Info', 'Tutte le ROM sono già state scaricate o sono in download.');
            return;
        }

        Alert.alert(
            'Conferma Download',
            `Vuoi scaricare ${romsToDownload.length} ROM per ${currentPlatform.name}?`,
            [
                { text: 'Annulla', style: 'cancel' },
                {
                    text: 'Scarica Tutto',
                    onPress: async () => {
                        setIsDownloadingAll(true);
                        try {
                            // Add all ROMs to download queue
                            romsToDownload.forEach(rom => {
                                addToQueue(rom, platformFolder);
                            });

                            Alert.alert(
                                'Download Avviato',
                                `${romsToDownload.length} ROM aggiunte alla coda di download.`
                            );
                        } catch (error) {
                            console.error('Error adding ROMs to queue:', error);
                            Alert.alert('Errore', 'Errore durante l\'aggiunta delle ROM alla coda di download.');
                        } finally {
                            setIsDownloadingAll(false);
                        }
                    }
                }
            ]
        );
    };

    // Show error if API call fails
    useEffect(() => {
        const error = romsError || platformError;
        if (error) {
            Alert.alert(
                'Errore',
                'Impossibile caricare i dati per questa piattaforma. Controlla la connessione di rete.',
                [{ text: 'OK' }]
            );
        }
    }, [romsError, platformError]);

    const GameCard = ({ rom }: { rom: Rom }) => (
        <TouchableOpacity
            style={styles.gameCard}
            activeOpacity={0.8}
            onPress={() => router.push(`/game/${rom.id}`)}
        >
            <View style={styles.gameImageContainer}>
                <Image
                    source={{
                        uri: rom.url_cover || `${apiClient.baseUrl}/assets/isotipo.png`
                    }}
                    style={styles.gameImage}
                />
                {isRomDownloaded(rom.id) && (
                    <View style={styles.completedBadge}>
                        <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                    </View>
                )}
                {isCheckingRom(rom.id) && (
                    <View style={styles.checkingBadge}>
                        <ActivityIndicator size={16} color="#FF9500" />
                    </View>
                )}
                {isDownloading(rom.id) && (
                    <View style={styles.downloadingBadge}>
                        <Ionicons name="download" size={20} color="#FFFFFF" />
                    </View>
                )}
            </View>
            <Text style={styles.gameTitle} numberOfLines={2}>
                {rom.name || rom.fs_name}
            </Text>
        </TouchableOpacity>
    );

    if (romsLoading || platformLoading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Caricamento...</Text>
            </View>
        );
    }

    if (!platformId || isNaN(platformId) || !currentPlatform) {
        return (
            <View style={[styles.container, styles.centered]}>
                <Text style={styles.errorText}>Piattaforma non trovata</Text>
            </View>
        );
    }

    // Calculate available ROMs to download
    const availableToDownload = roms.filter(rom => !isDownloading(rom.id) && !isRomDownloaded(rom.id)).length;

    return (
        <View style={styles.container}>
            {/* Header Section */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity style={styles.backButton} onPress={navigation.goBack}>
                        <Ionicons name="arrow-back-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>{currentPlatform?.name || 'Piattaforma sconosciuta'}</Text>
                    </View>
                    <View style={styles.headerButtons}>
                        <TouchableOpacity
                            style={styles.folderButton}
                            onPress={() => showFolderSelectionDialog()}
                        >
                            <Ionicons name="folder-outline" size={20} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[
                                styles.downloadAllButton,
                                availableToDownload === 0 && styles.downloadAllButtonDisabled
                            ]}
                            onPress={handleDownloadAll}
                            disabled={isDownloadingAll || availableToDownload === 0}
                        >
                            {isDownloadingAll ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="download" size={20} color="#fff" />
                                    {availableToDownload > 0 && (
                                        <Text style={styles.downloadAllText}>{availableToDownload}</Text>
                                    )}
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Games Grid */}
            <ScrollView
                style={styles.gamesContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#fff"
                        colors={['#007AFF']}
                        progressBackgroundColor="#333"
                    />
                }
            >
                <View style={styles.gamesGrid}>
                    {roms.map((rom) => (
                        <GameCard key={rom.id} rom={rom} />
                    ))}
                    {roms.length === 0 && !romsLoading && !platformLoading && (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="game-controller-outline" size={64} color="#666" />
                            <Text style={styles.emptyText}>Nessuna ROM trovata per questa piattaforma</Text>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 25,
        paddingBottom: 10,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 1,
    },
    backButton: {
        paddingRight: 10,
        borderRadius: 8,
    },
    headerLeft: {
        flex: 1,
    },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    folderButton: {
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#333',
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
    },
    downloadAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#007AFF',
        minWidth: 44,
        minHeight: 44,
        justifyContent: 'center',
    },
    downloadAllButtonDisabled: {
        backgroundColor: '#555',
        opacity: 0.6,
    },
    downloadAllText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        minWidth: 16,
        textAlign: 'center',
    },
    loadingText: {
        color: '#fff',
        fontSize: 16,
        marginTop: 10,
    },
    errorText: {
        color: '#ff6b6b',
        fontSize: 16,
        textAlign: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
        width: '100%',
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
    },
    platformSection: {
        paddingHorizontal: 20,
        paddingVertical: 15,
    },
    platformHeader: {
        marginBottom: 15,
    },
    platformInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    platformTitle: {
        color: '#fff',
        fontSize: 28,
        fontWeight: 'bold',
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    controlButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#333',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 8,
    },
    controlText: {
        color: '#fff',
        fontSize: 14,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 15,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#333',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        gap: 6,
    },
    statText: {
        color: '#fff',
        fontSize: 12,
    },
    recentDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#4CAF50',
    },
    categoriesContainer: {
        marginTop: 10,
    },
    categoryTag: {
        backgroundColor: '#333',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 15,
        marginRight: 10,
    },
    categoryText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    gamesContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    gamesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingBottom: 20,
    },
    gameCard: {
        width: (width - 60) / 5,
        marginBottom: 20,
    },
    gameImageContainer: {
        position: 'relative',
        width: '100%',
        height: 120,
        marginBottom: 8,
    },
    gameImage: {
        width: '100%',
        height: 120,
        borderRadius: 12,
        backgroundColor: '#333',
        resizeMode: 'contain',
    },
    newBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 215, 0, 0.9)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    completedBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 15,
        padding: 2,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
    checkingBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(255, 149, 0, 0.9)',
        borderRadius: 12,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
    downloadingBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0, 122, 255, 0.9)',
        borderRadius: 12,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 5,
    },
    badgeText: {
        color: '#000',
        fontSize: 10,
        fontWeight: 'bold',
    },
    gameTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 18,
    },
});