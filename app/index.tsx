import { useRomDownload } from '@/hooks/useRomDownload';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BaseFolderModal } from '../components/BaseFolderModal';
import { CollectionCoverGrid } from '../components/CollectionCoverGrid';
import { DownloadStatusBar } from '../components/DownloadStatusBar';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useDownload } from '../contexts/DownloadContext';
import { useToast } from '../contexts/ToastContext';
import { useAuthCheck, useLogout } from '../hooks/useAuth';
import { useCollections } from '../hooks/useCollections';
import { usePlatformFolders } from '../hooks/usePlatformFolders';
import { useRomFileSystem } from '../hooks/useRomFileSystem';
import { usePlatforms, useRoms } from '../hooks/useRoms';
import { useTranslation } from '../hooks/useTranslation';
import { apiClient, Platform as ApiPlatform, Collection, CollectionType, Rom } from '../services/api';

const { width } = Dimensions.get('window');

export default function LibraryScreen() {
    const { t } = useTranslation();
    const { platforms, loading, error, fetchPlatforms } = usePlatforms(false); // Don't auto-fetch
    const { userCollections, generatedCollections, loading: collectionsLoading, error: collectionsError, fetchCollections, getCollectionTypeName } = useCollections(false);
    const { recentlyAddedRoms, fetchRecentlyAddedRoms } = useRoms();
    const { user, username, isAuthenticated } = useAuthCheck();
    const { logout, isLoading: isLoggingOut } = useLogout();
    const { showErrorToast, showInfoToast } = useToast();
    const [refreshing, setRefreshing] = useState(false);
    const [recentRomsLoading, setRecentRomsLoading] = useState(false);
    const { activeDownloads, isDownloading, completedDownloads } = useDownload();
    const { downloadRom } = useRomDownload();
    const { platformFolders, hasBaseFolder } = usePlatformFolders();
    const { resetRomsCheck, refreshRomCheck, isRomDownloaded, isCheckingRom } = useRomFileSystem();
    const insets = useSafeAreaInsets();
    const [showBaseFolderModal, setShowBaseFolderModal] = useState(false);
    const [baseFolderChecked, setBaseFolderChecked] = useState(false);

    const loadRecentRoms = async (needResetRom: boolean = false) => {
        await fetchRecentlyAddedRoms();
        if (recentlyAddedRoms && recentlyAddedRoms.length > 0) {
            if (needResetRom) {
                resetRomsCheck(recentlyAddedRoms);
            }
            await Promise.all(recentlyAddedRoms.map(rom => refreshRomCheck(rom)));
        }
    };

    // Function for refresh
    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await Promise.all([
                fetchPlatforms(),
                fetchCollections(),
                loadRecentRoms(true),
            ]);
            console.log('Refresh completed');
            setRefreshing(false);
            
        } catch (error) {
            console.error('Error during refresh:', error);
        } finally {
            setRefreshing(false);
        }
    };

    // Fetch platforms only after authentication is verified
    useEffect(() => {
        console.log('isAuthenticated:', isAuthenticated);
        if (isAuthenticated) {
            
            Promise.all([
                fetchPlatforms(),
                fetchCollections(),
                loadRecentRoms(true)
            ]);
        }
    }, [isAuthenticated]);

    useEffect(() => {
        resetRomsCheck(recentlyAddedRoms);
    }, []);

    // Check for base folder when authenticated
    useEffect(() => {
        const checkBaseFolderRequired = async () => {
            if (isAuthenticated && !baseFolderChecked) {
                try {
                    const hasFolder = await hasBaseFolder();
                    if (!hasFolder) {
                        setShowBaseFolderModal(true);
                    }
                } catch (error) {
                    console.error('Error checking base folder:', error);
                } finally {
                    setBaseFolderChecked(true);
                }
            }
        };

        checkBaseFolderRequired();
    }, [isAuthenticated, baseFolderChecked, hasBaseFolder]);

    // // Check filesystem for existing ROMs when recently added ROMs are loaded
    // useEffect(() => {
    //     const checkRecentRomFolders = async () => {
    //         if (recentlyAddedRoms && recentlyAddedRoms.length > 0) {
    //             for (const rom of recentlyAddedRoms) {
    //                 //await refreshRomCheck(rom);
    //             }
    //         }
    //     };
    //     checkRecentRomFolders();
    // }, [recentlyAddedRoms, platformFolders, refreshRomCheck]);

    // Monitor completed downloads to refresh ROM status
    useEffect(() => {
        Promise.all(completedDownloads.map(downloadedItem => refreshRomCheck(downloadedItem.rom)));
    }, [completedDownloads.length]);

    const handleLogout = async () => {
        Alert.alert(
            t('logoutAction'),
            t('confirmLogout'),
            [
                {
                    text: t('cancel'),
                    style: 'cancel',
                },
                {
                    text: t('exit'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await AsyncStorage.clear();
                            await logout();
                        } catch (error) {
                            console.error('Logout error:', error);
                        }
                    },
                },
            ],
        );
    };

    // Show error if API call fails
    useEffect(() => {
        if (error || collectionsError) {
            showErrorToast(
                t('unableToLoadData'),
                t('error')
            );
        }
    }, [error, collectionsError, showErrorToast, t]);

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

    const handleBaseFolderComplete = () => {
        setShowBaseFolderModal(false);
        setBaseFolderChecked(true);
    };

    const PlatformCard = ({ platform }: { platform: ApiPlatform }) => (
        <TouchableOpacity
            style={styles.platformCard}
            activeOpacity={0.8}
            onPress={() => router.push(`/platform/${platform.id}`)}
        >
            <View style={styles.platformImageContainer}>
                <Image
                    source={{
                        uri: `${apiClient.baseUrl}/assets/platforms/${platform.slug}.ico`
                    }}
                    style={styles.platformImage}
                />
            </View>
            <View style={styles.platformInfo}>
                <Text style={styles.platformName} numberOfLines={1}>
                    {platform.name}
                </Text>
                <Text style={styles.gamesCount}>
                    {platform.rom_count} {t('games')}
                </Text>
            </View>
        </TouchableOpacity>
    );

    const CollectionCard = ({ collection }: { collection: Collection }) => (
        <TouchableOpacity
            style={styles.collectionCard}
            activeOpacity={0.8}
            onPress={() => router.push(`/collection/${collection.id}?virtual=${collection.is_virtual}`)}
        >
            <View style={styles.collectionImageContainer}>
                <CollectionCoverGrid
                    covers={collection.path_covers_small || []}
                    style={styles.collectionImage}
                />
            </View>
            <View style={styles.collectionInfo}>
                <Text style={styles.collectionName} numberOfLines={1}>
                    {collection.name}
                </Text>
                <Text style={styles.collectionCount}>
                    {collection.rom_count} {t('games')}
                </Text>
            </View>
        </TouchableOpacity>
    );

    const RomCard = ({ rom }: { rom: Rom }) => (
        <TouchableOpacity
            style={styles.romCard}
            activeOpacity={0.8}
            onPress={() => router.push(`/game/${rom.id}`)}
        >
            <View style={styles.romImageContainer}>
                {rom.url_cover ? (
                    <Image
                        source={{ uri: rom.url_cover }}
                        style={styles.romImage}
                    />
                ) : (
                    <View style={styles.romPlaceholder}>
                        <Ionicons name="game-controller-outline" size={32} color="#666" />
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
            <View style={styles.romInfo}>
                <Text style={styles.romName} numberOfLines={2}>
                    {rom.name}
                </Text>
                <Text style={styles.romPlatform} numberOfLines={1}>
                    {rom.platform_name}
                </Text>
            </View>
        </TouchableOpacity>
    );

    if (loading && collectionsLoading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>{t('loading')}</Text>
            </View>
        );
    }

    return (
        <ProtectedRoute>
            <View style={styles.container}>
                <ScrollView
                    style={styles.content}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={['#5f43b2']} // Android
                            tintColor="#5f43b2" // iOS
                        />
                    }
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerTop}>
                            <View style={styles.headerLeft}>
                                <Text style={styles.headerTitle}>{t('library')}</Text>
                                {username && (
                                    <Text style={styles.welcomeText}>
                                        {t('welcomeUser', { username })}
                                    </Text>
                                )}
                            </View>
                            <View style={styles.headerButtons}>
                                <TouchableOpacity
                                    style={styles.headerButton}
                                    onPress={() => router.push('/search')}
                                >
                                    <Ionicons name="search-outline" size={24} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.headerButton, activeDownloads.length > 0 && styles.downloadButtonActive]}
                                    onPress={() => router.push('/downloads')}
                                >
                                    <Ionicons name="download-outline" size={24} color="#fff" />
                                    {activeDownloads.length > 0 && (
                                        <View style={styles.downloadBadge}>
                                            <Text style={styles.downloadBadgeText}>
                                                {activeDownloads.length}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.headerButton}
                                    onPress={() => router.push('/settings')}
                                >
                                    <Ionicons name="settings-outline" size={24} color="#fff" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.headerButton}
                                    onPress={handleLogout}
                                    disabled={isLoggingOut}
                                >
                                    {isLoggingOut ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <Ionicons name="log-out-outline" size={24} color="#fff" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>


                    {/* Recent ROMs Section */}
                    {recentlyAddedRoms && recentlyAddedRoms.length > 0 && (
                        <View style={styles.recentRomsContainer}>
                            <Text style={styles.sectionTitle}>{t('recentlyAdded')}</Text>
                            {recentRomsLoading ? (
                                <View style={styles.emptyContainer}>
                                    <ActivityIndicator size="large" color="#5f43b2" />
                                </View>
                            ) : (
                                <FlatList
                                    data={recentlyAddedRoms}
                                    renderItem={({ item }) => <RomCard rom={item} />}
                                    keyExtractor={(item) => item.id.toString()}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={styles.horizontalList}
                                />
                            )}
                        </View>
                    )}

                    {/* Platforms Grid */}
                    <View style={styles.platformsContainer}>
                        <Text style={styles.sectionTitle}>{t('platformsSection')}</Text>
                        {platforms.length > 0 ? (
                            <FlatList
                                data={platforms}
                                renderItem={({ item }) => <PlatformCard platform={item} />}
                                keyExtractor={(item) => item.id.toString()}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.horizontalList}
                            />
                        ) : !loading && (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="game-controller-outline" size={64} color="#666" />
                                <Text style={styles.emptyText}>{t('noPlatformsAvailable')}</Text>
                            </View>
                        )}
                    </View>

                    {/* User Collections Section */}
                    {userCollections && userCollections.length > 0 && (
                        <View style={styles.collectionsContainer}>
                            <Text style={styles.sectionTitle}>{t('customCollections')}</Text>
                            <FlatList
                                data={userCollections}
                                renderItem={({ item }) => <CollectionCard collection={item} />}
                                keyExtractor={(item) => item.id.toString()}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={styles.horizontalList}
                            />
                        </View>
                    )}

                    {/* Generated Collections Section */}
                    {generatedCollections && Object.keys(generatedCollections).length > 0 && (
                        <View style={styles.collectionsContainer}>
                            {Object.entries(generatedCollections).map(([type, collections]) => (
                                <View key={type}>
                                    <Text style={styles.sectionTitle}>{getCollectionTypeName(type as CollectionType)}</Text>
                                    <FlatList
                                        data={collections}
                                        renderItem={({ item }) => <CollectionCard collection={item} />}
                                        keyExtractor={(item) => item.id.toString()}
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        contentContainerStyle={styles.horizontalList}
                                    />
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Bottom padding for download status bar */}
                    {activeDownloads.length > 0 && <View style={[styles.bottomPadding, { height: 80 + insets.bottom }]} />}
                </ScrollView>
                <DownloadStatusBar onPress={() => router.push('/downloads')} />
            </View>
            <BaseFolderModal
                visible={showBaseFolderModal}
                onComplete={handleBaseFolderComplete}
            />
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
    content: {
        flex: 1,
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    headerLeft: {
        flex: 1,
    },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerButton: {
        padding: 10,
        borderRadius: 8,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
    },
    welcomeText: {
        color: '#ccc',
        fontSize: 14,
        marginTop: 4,
    },
    platformsContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    collectionsContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    horizontalList: {
        paddingHorizontal: 5,
    },
    platformsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    platformCard: {
        width: 120,
        marginHorizontal: 8,
        marginBottom: 20,
        backgroundColor: '#111',
        borderRadius: 12,
        overflow: 'hidden',
    },
    platformImageContainer: {
        position: 'relative',
        height: 100,
        backgroundColor: '#333',
    },
    platformImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'contain',
    },
    platformInfo: {
        padding: 12,
    },
    platformName: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
        textAlign: 'center',
    },
    gamesCount: {
        color: '#999',
        fontSize: 10,
        textAlign: 'center',
    },
    collectionCard: {
        width: 140,
        marginHorizontal: 8,
        backgroundColor: '#111',
        borderRadius: 12,
        overflow: 'hidden',
    },
    collectionImageContainer: {
        height: 100,
        backgroundColor: '#333',
    },
    collectionImage: {
        width: '100%',
        height: '100%',
    },
    collectionInfo: {
        padding: 12,
    },
    collectionName: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
        textAlign: 'center',
    },
    collectionCount: {
        color: '#999',
        fontSize: 10,
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
    romsFolderStatus: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        marginBottom: 10,
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    statusText: {
        fontSize: 14,
        flex: 1,
    },
    configureButton: {
        backgroundColor: '#5f43b2',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6,
    },
    configureButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    downloadButtonActive: {
        backgroundColor: '#007AFF',
    },
    downloadBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    downloadBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    bottomPadding: {
        height: 80, // Sufficient height to avoid overlap with the download status bar
    },
    romCard: {
        width: 140,
        marginHorizontal: 8,
        backgroundColor: '#111',
        borderRadius: 12,
        overflow: 'hidden',
    },
    romImageContainer: {
        height: 100,
        backgroundColor: '#333',
        position: 'relative',
    },
    romImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    romPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#222',
    },
    romInfo: {
        padding: 12,
    },
    romName: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        marginBottom: 4,
        textAlign: 'center',
    },
    romPlatform: {
        color: '#999',
        fontSize: 10,
        textAlign: 'center',
    },
    recentRomsContainer: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    romOverlay: {
        position: 'absolute',
        bottom: 8,
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
});