import { DownloadStatusBar } from '@/components/DownloadStatusBar';
import { useRomDownload } from '@/hooks/useRomDownload';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useDownload } from '../../contexts/DownloadContext';
import { useToast } from '../../contexts/ToastContext';
import { usePlatformFolders } from '../../hooks/usePlatformFolders';
import { useRomFileSystem } from '../../hooks/useRomFileSystem';
import { useRomsByCollection } from '../../hooks/useRoms';
import { useTranslation } from '../../hooks/useTranslation';
import { useDynamicColumns } from '../../hooks/useDynamicColumns';
import { apiClient, Collection as ApiCollection, Rom } from '../../services/api';

interface CollectionScreenProps { }

export default function CollectionScreen({ }: CollectionScreenProps) {
    const { id, virtual } = useLocalSearchParams<{ id: string; virtual?: string }>();
    const collectionId = id;
    const isVirtual = virtual === 'true';
    const { t } = useTranslation();
    const { roms, loading, error, fetchRoms } = useRomsByCollection(collectionId, isVirtual);
    const [collection, setCollection] = useState<ApiCollection | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [isDownloadingAll, setIsDownloadingAll] = useState(false);
    const { activeDownloads, addToQueue, isDownloading, completedDownloads } = useDownload();
    const { downloadRom } = useRomDownload();
    const { showErrorToast, showInfoToast, showSuccessToast } = useToast();
    const { platformFolders, getPlatformFolder } = usePlatformFolders();
    const { checkMultipleRoms, isRomDownloaded, isCheckingRom, refreshRomCheck } = useRomFileSystem();
    const insets = useSafeAreaInsets();

    // Dynamic columns based on screen orientation and device size
    const { columns, cardWidth, isLandscape } = useDynamicColumns();

    // Debug platform folders
    useEffect(() => {
        console.log('Platform folders updated:', platformFolders);
    }, [platformFolders]);

    // Fetch collection info and roms
    useEffect(() => {
        console.log('Fetching collection data for ID:', collectionId);
        const fetchData = async () => {
            try {
                console.log('Fetching collection data for ID:', collectionId, 'isVirtual:', isVirtual);
                const collectionData = await apiClient.getCollection(collectionId, isVirtual);
                setCollection(collectionData);
                await fetchRoms();
            } catch (error) {
                console.error('Error fetching collection data:', error);
                showErrorToast(
                    t('unableToLoadCollection'),
                    t('error')
                );
                router.back();
            }
        };

        if (collectionId) {
            fetchData();
        }
    }, [collectionId]);

    // Check filesystem for existing ROMs when ROMs are loaded
    useEffect(() => {
        checkCollectionRomFolders();
    }, [roms, platformFolders, checkMultipleRoms]);

    // Monitor completed downloads to refresh ROM status in collection view
    useEffect(() => {
        if (completedDownloads.length > 0 && roms && roms.length > 0) {
            console.log('Completed downloads detected in collection, rechecking ROM folders');
            checkCollectionRomFolders();
        }
    }, [completedDownloads.length, roms?.length]);

    const checkCollectionRomFolders = async () => {
        if (roms && roms.length > 0) {
            console.log(`Checking ${roms.length} ROMs in collection ${collection?.name}`);
            for (const rom of roms) {
                const platformFolder = platformFolders.find(
                    folder => folder.platformSlug === rom.platform_slug
                );
                if (platformFolder) {
                    console.log(`Checking ROM ${rom.fs_name} in platform ${rom.platform_name}`);
                    await checkMultipleRoms([rom], platformFolder.folderUri);
                } else {
                    console.log(`No platform folder found for ${rom.platform_name} (${rom.platform_slug})`);
                }
            }
            console.log('Collection ROM check completed');
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchRoms();
            console.log('Collection data refreshed, forcing complete ROM check');

            // Force a complete refresh of ROM checks for all ROMs
            setTimeout(async () => {
                if (roms && roms.length > 0) {
                    console.log('Force refreshing all ROM checks in collection');
                    for (const rom of roms) {
                        await refreshRomCheck(rom);
                    }
                    console.log('All collection ROM checks refreshed');
                }
            }, 500); // Small delay to ensure data is updated
        } catch (error) {
            console.error('Error during refresh:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const handleDownload = async (rom: Rom) => {
        if (!rom) return;

        try {
            await downloadRom(rom);

        } catch (error: any) {
            console.error('Download error:', error);

            if (error.type === 'already_downloaded') {
                showInfoToast(error.message, t('fileAlreadyDownloaded'));
            } else {
                const errorMessage = error instanceof Error ? error.message : t('errorDuringDownload');
                showErrorToast(
                    errorMessage,
                    t('downloadError')
                );
            }
        }
    };

    const handleDownloadAll = async () => {
        if (!collection || roms.length === 0) {
            showErrorToast(t('noRomsAvailable'), t('error'));
            return;
        }

        // Get all unique platforms from the collection's ROMs
        const uniquePlatforms = [...new Set(roms.map(rom => rom.platform_slug))];

        // Check if all platforms have configured folders
        const missingFolders: string[] = [];
        for (const platformSlug of uniquePlatforms) {
            const platformFolder = await getPlatformFolder(platformSlug);
            if (!platformFolder) {
                const platform = roms.find(rom => rom.platform_slug === platformSlug);
                missingFolders.push(platform?.platform_name || platformSlug);
            }
        }

        if (missingFolders.length > 0) {
            Alert.alert(
                t('error'),
                t('selectFolderFirst', { platform: missingFolders.join(', ') }),
                [{ text: t('ok'), style: 'default' }]
            );
            return;
        }

        // Filter out ROMs that are already being downloaded or already exist on filesystem
        const romsToDownload = roms.filter(rom => !isDownloading(rom.id) && !isRomDownloaded(rom.id));

        if (romsToDownload.length === 0) {
            showInfoToast(t('allRomsDownloaded'), t('info'));
            return;
        }

        Alert.alert(
            t('confirmDownload'),
            t('downloadAllRomsQuestionCollection', { count: romsToDownload.length.toString(), collection: collection.name }),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('downloadAll'),
                    onPress: async () => {
                        setIsDownloadingAll(true);
                        try {
                            // Add all ROMs to download queue with their respective platform folders
                            for (const rom of romsToDownload) {
                                const platformFolder = await getPlatformFolder(rom.platform_slug);
                                if (platformFolder) {
                                    addToQueue(rom, platformFolder);
                                }
                            }

                            showSuccessToast(
                                t('romsAddedToQueue', { count: romsToDownload.length.toString() }),
                                t('downloadAllStarted')
                            );
                        } catch (error) {
                            console.error('Error adding ROMs to queue:', error);
                            showErrorToast(t('errorAddingToQueue'), t('error'));
                        } finally {
                            setIsDownloadingAll(false);
                        }
                    }
                }
            ]
        );
    };

    const RomCard = ({ rom }: { rom: Rom & { isEmpty?: boolean } }) => {
        if (rom.isEmpty) {
            return <View style={[styles.gameCard, { width: cardWidth }]} />;
        }

        const hasImage = rom.url_cover && rom.url_cover.trim() !== '';

        // Calculate card height based on width to maintain aspect ratio
        const cardHeight = Math.floor(cardWidth * 1.4); // 1.4 aspect ratio

        return (
            <Pressable
                style={[styles.gameCard, { width: cardWidth }]}
                onPress={() => router.push(`/game/${rom.id}`)}
            >
                <View style={[styles.gameImageContainer, { height: cardHeight }]}>
                    {hasImage ? (
                        <Image
                            source={{ uri: rom.url_cover }}
                            style={styles.gameImage}
                        />
                    ) : (
                        <View style={styles.placeholderContainer}>
                            <Ionicons name="game-controller-outline" size={Math.min(32, cardWidth * 0.2)} color="#666" />
                            <Text style={[styles.gameTitle, { fontSize: Math.min(14, cardWidth * 0.1) }]} numberOfLines={2}>
                                {rom.name || rom.fs_name}
                            </Text>
                        </View>
                    )}

                    {/* Status Badges */}
                    {isRomDownloaded(rom.id) && (
                        <View style={styles.completedBadge}>
                            <Ionicons name="checkmark-circle" size={Math.min(24, cardWidth * 0.16)} color="#34C759" />
                        </View>
                    )}
                    {isCheckingRom(rom.id) && (
                        <View style={styles.checkingBadge}>
                            <ActivityIndicator size={Math.min(16, cardWidth * 0.11)} color="#FF9500" />
                        </View>
                    )}
                    {isDownloading(rom.id) && (
                        <View style={styles.downloadingBadge}>
                            <Ionicons name="download" size={Math.min(20, cardWidth * 0.13)} color="#FFFFFF" />
                        </View>
                    )}

                    {/* Download Button - Only show if not downloaded and not downloading */}
                    {!isRomDownloaded(rom.id) && !isDownloading(rom.id) && (
                        <View style={styles.romOverlay}>
                            <TouchableOpacity
                                style={[styles.downloadButton, {
                                    width: Math.min(32, cardWidth * 0.21),
                                    height: Math.min(32, cardWidth * 0.21)
                                }]}
                                onPress={() => handleDownload(rom)}
                            >
                                <Ionicons name="download-outline" size={Math.min(16, cardWidth * 0.11)} color="#fff" />
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </Pressable>
        );
    };

    if (loading && !collection) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>{t('loadingCollection')}</Text>
            </View>
        );
    }

    // Prepare data for FlatList with empty items to fill last row
    const prepareGridData = (data: Rom[]) => {
        const totalItems = data.length;
        const remainder = totalItems % columns;
        if (remainder === 0) return data;

        const emptyItems = columns - remainder;
        const paddedData = [...data];
        for (let i = 0; i < emptyItems; i++) {
            paddedData.push({ id: `empty-${i}`, isEmpty: true } as any);
        }
        return paddedData;
    };

    // Calculate available ROMs to download
    const availableToDownload = roms.filter(rom => !isDownloading(rom.id) && !isRomDownloaded(rom.id)).length;

    return (
        <ProtectedRoute>
            <View style={styles.container}>
                {/* Header */}
                <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                    <View style={styles.headerTop}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => router.back()}
                        >
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.headerInfo}>
                            <Text style={styles.headerTitle} numberOfLines={1}>
                                {collection?.name || t('collection')}
                            </Text>
                            <Text style={styles.headerSubtitle}>
                                {roms.length} {t('games')}
                            </Text>
                        </View>
                        <View style={styles.headerButtons}>
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
                    {collection?.description && (
                        <Text style={styles.description}>
                            {collection.description}
                        </Text>
                    )}
                </View>

                {/* Roms Grid */}
                <FlatList
                    data={prepareGridData(roms)}
                    renderItem={({ item }) => <RomCard rom={item} />}
                    keyExtractor={(item) => item.id.toString()}
                    numColumns={columns}
                    key={`${columns}-${isLandscape}`} // Force re-render when columns or orientation change
                    columnWrapperStyle={columns > 1 ? styles.row : undefined}
                    contentContainerStyle={styles.gamesContainer}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#5f43b2']}
                            tintColor="#5f43b2"
                        />
                    }
                    ListEmptyComponent={
                        !loading ? (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="library-outline" size={64} color="#666" />
                                <Text style={styles.emptyText}>
                                    {t('noGamesInCollection')}
                                </Text>
                            </View>
                        ) : null
                    }
                    contentInsetAdjustmentBehavior="automatic"
                />

                <DownloadStatusBar onPress={() => router.push('/downloads')} />
            </View>
        </ProtectedRoute>
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
    loadingText: {
        color: '#fff',
        fontSize: 16,
        marginTop: 10,
    },
    header: {
        paddingHorizontal: 20,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    backButton: {
        marginRight: 15,
        padding: 5,
    },
    headerInfo: {
        flex: 1,
    },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    headerSubtitle: {
        color: '#999',
        fontSize: 14,
        marginTop: 2,
    },
    description: {
        color: '#ccc',
        fontSize: 14,
        lineHeight: 20,
    },
    gamesContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    row: {
        justifyContent: 'space-between',
        paddingHorizontal: 0,
        marginBottom: 15,
    },
    gameCard: {
        marginTop: 20,
        marginBottom: 15,
    },
    gameImageContainer: {
        position: 'relative',
        width: '100%',
    },
    gameImage: {
        width: '100%',
        height: "100%",
        borderRadius: 12,
        backgroundColor: '#333',
        objectFit: 'cover',
    },
    placeholderContainer: {
        width: '100%',
        height: '100%',
        backgroundColor: '#222',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 8,
        borderRadius: 12,
    },
    gameTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 18,
        marginTop: 8,
    },
    romOverlay: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    downloadButton: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    downloadButtonDisabled: {
        backgroundColor: 'rgba(95, 67, 178, 0.7)',
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
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: '#666',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
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
});
