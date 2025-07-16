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
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useDownload } from '../../contexts/DownloadContext';
import { usePlatformFolders } from '../../hooks/usePlatformFolders';
import { useRomFileSystem } from '../../hooks/useRomFileSystem';
import { useRomsByCollection } from '../../hooks/useRoms';
import { useTranslation } from '../../hooks/useTranslation';
import { apiClient, Collection as ApiCollection, Rom } from '../../services/api';

const { width } = Dimensions.get('window');

interface CollectionScreenProps { }

export default function CollectionScreen({ }: CollectionScreenProps) {
    const { id, virtual } = useLocalSearchParams<{ id: string; virtual?: string }>();
    const collectionId = id;
    const isVirtual = virtual === 'true';
    const { t } = useTranslation();
    const { roms, loading, error, fetchRoms } = useRomsByCollection(collectionId, isVirtual);
    const [collection, setCollection] = useState<ApiCollection | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const { activeDownloads, addToQueue, isDownloading, completedDownloads } = useDownload();
    const { downloadRom } = useRomDownload();
    const { platformFolders } = usePlatformFolders();
    const { checkMultipleRoms, isRomDownloaded, isCheckingRom } = useRomFileSystem();
    const insets = useSafeAreaInsets();

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
                Alert.alert(
                    t('error'),
                    t('unableToLoadCollection'),
                    [{ text: 'OK', onPress: () => router.back() }]
                );
            }
        };

        if (collectionId) {
            fetchData();
        }
    }, [collectionId]);

    // Check filesystem for existing ROMs when ROMs are loaded
    useEffect(() => {
        const checkCollectionRomFolders = async () => {
            if (roms && roms.length > 0) {
                for (const rom of roms) {
                    const platformFolder = platformFolders.find(
                        folder => folder.platformSlug === rom.platform_slug
                    );
                    if (platformFolder) {
                        checkMultipleRoms([rom], platformFolder.folderUri);
                    }
                }
            }
        };
        checkCollectionRomFolders();
    }, [roms, platformFolders, checkMultipleRoms]);

    // Monitor completed downloads to refresh ROM status in collection view
    useEffect(() => {
        if (completedDownloads.length > 0 && roms && roms.length > 0) {
            const checkCollectionRomFoldersAfterDownload = async () => {
                for (const rom of roms) {
                    const platformFolder = platformFolders.find(
                        folder => folder.platformSlug === rom.platform_slug
                    );
                    if (platformFolder) {
                        checkMultipleRoms([rom], platformFolder.folderUri);
                    }
                }
            };
            checkCollectionRomFoldersAfterDownload();
        }
    }, [completedDownloads.length, roms, platformFolders, checkMultipleRoms]);

    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchRoms();
            for (const rom of roms) {
                const platformFolder = platformFolders.find(
                    folder => folder.platformSlug === rom.platform_slug
                );
                console.log(`Checking ROM ${rom.fs_name} in folder:`, platformFolder?.folderUri);
                if (platformFolder) {
                    await checkMultipleRoms([rom], platformFolder.folderUri);
                }
            }
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

        } catch (error) {
            console.error('Download error:', error);
            const errorMessage = error instanceof Error ? error.message : t('errorDuringDownload');
            Alert.alert(
                t('downloadError'),
                errorMessage
            );
        }
    };

    const RomCard = ({ rom }: { rom: Rom & { isEmpty?: boolean } }) => {
        if (rom.isEmpty) {
            return <View style={styles.gameCard} />;
        }

        const hasImage = rom.url_cover && rom.url_cover.trim() !== '';

        return (
            <Pressable
                style={[styles.gameCard]}
                onPress={() => router.push(`/game/${rom.id}`)}
            >
                <View style={styles.gameImageContainer}>
                    {hasImage ? (
                        <Image
                            source={{ uri: rom.url_cover }}
                            style={styles.gameImage}
                        />
                    ) : (
                        <View style={styles.placeholderContainer}>
                            <Ionicons name="game-controller-outline" size={32} color="#666" />
                            <Text style={styles.gameTitle} numberOfLines={2}>
                                {rom.name || rom.fs_name}
                            </Text>
                        </View>
                    )}

                    {/* Status Badges */}
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

                    {/* Download Button - Only show if not downloaded and not downloading */}
                    {!isRomDownloaded(rom.id) && !isDownloading(rom.id) && (
                        <View style={styles.romOverlay}>
                            <TouchableOpacity
                                style={styles.downloadButton}
                                onPress={() => handleDownload(rom)}
                            >
                                <Ionicons name="download-outline" size={16} color="#fff" />
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
    const ITEMS_PER_ROW = 5;
    const prepareGridData = (data: Rom[]) => {
        const totalItems = data.length;
        const remainder = totalItems % ITEMS_PER_ROW;
        if (remainder === 0) return data;

        const emptyItems = ITEMS_PER_ROW - remainder;
        const paddedData = [...data];
        for (let i = 0; i < emptyItems; i++) {
            paddedData.push({ id: `empty-${i}`, isEmpty: true } as any);
        }
        return paddedData;
    };

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
                    numColumns={5}
                    columnWrapperStyle={styles.row}
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
    },
    gameCard: {
        width: 150,
        marginTop: 20,
        marginBottom: 30,
    },
    gameImageContainer: {
        position: 'relative',
        width: '100%',
        height: 200,
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
        width: 32,
        height: 32,
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
});
