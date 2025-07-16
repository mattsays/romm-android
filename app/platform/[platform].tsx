import { DownloadStatusBar } from '@/components/DownloadStatusBar';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Pressable,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useDownload } from '../../contexts/DownloadContext';
import { useToast } from '../../contexts/ToastContext';
import { useDynamicColumns } from '../../hooks/useDynamicColumns';
import { usePlatformFolders } from '../../hooks/usePlatformFolders';
import { useRomFileSystem } from '../../hooks/useRomFileSystem';
import { usePlatform, useRoms } from '../../hooks/useRoms';
import { useStorageAccessFramework } from '../../hooks/useStorageAccessFramework';
import { useTranslation } from '../../hooks/useTranslation';
import { Rom } from '../../services/api';

export default function PlatformScreen() {
    const { platform } = useLocalSearchParams();
    const navigation = useNavigation();
    const { t } = useTranslation();
    const { roms, loading: romsLoading, error: romsError, fetchRomsByPlatform } = useRoms();
    const { platform: currentPlatform, loading: platformLoading, error: platformError, fetchPlatform } = usePlatform();
    const { addToQueue, isDownloading, completedDownloads } = useDownload();
    const { getPlatformFolder, savePlatformFolder, hasPlatformFolder } = usePlatformFolders();
    const { checkMultipleRoms, isRomDownloaded, isCheckingRom, refreshRomCheck } = useRomFileSystem();
    const { requestDirectoryPermissions } = useStorageAccessFramework();
    const { showSuccessToast, showErrorToast, showInfoToast } = useToast();
    const [isDownloadingAll, setIsDownloadingAll] = useState(false);
    const [folderSelectionShown, setFolderSelectionShown] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Dynamic columns based on screen orientation and device size
    const { columns, cardWidth, isLandscape } = useDynamicColumns();

    const platformId = Number(platform);

    const selectedPlatform = currentPlatform?.name;

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
        checkRomFolders();
    }, [roms, currentPlatform, checkMultipleRoms]);

    // Monitor completed downloads to refresh ROM status
    useEffect(() => {
        if (completedDownloads.length > 0 && roms.length > 0 && currentPlatform) {
            console.log('Completed downloads detected, rechecking ROM folders');
            checkRomFolders();
        }
    }, [completedDownloads.length, roms.length, currentPlatform]);

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

    const checkRomFolders = async () => {
        if (roms.length > 0 && currentPlatform) {
            console.log(`Checking ${roms.length} ROMs for platform ${currentPlatform.name}`);
            const folder = await getPlatformFolder(currentPlatform.slug);
            if (folder?.folderUri) {
                console.log('Platform folder found, checking ROMs:', folder.folderUri);
                await checkMultipleRoms(roms, folder.folderUri);
                console.log('ROM check completed');
            } else {
                console.log('No platform folder configured for:', currentPlatform.slug);
            }
        }
    };

    const showFolderSelectionDialog = async () => {
        if (!currentPlatform) return;

        const hasFolder = await hasPlatformFolder(currentPlatform.slug);
        const currentFolder = await getPlatformFolder(currentPlatform.slug);

        Alert.alert(
            hasFolder ? t('changeFolderTitle') : t('selectFolderTitle'),
            hasFolder
                ? `${t('currentFolder', { folderName: currentFolder?.folderName || '' })}\n\n${t('selectNewFolderQuestion', { platform: currentPlatform.name })}`
                : t('selectFolderToDownload', { platform: currentPlatform.name }),
            [
                {
                    text: hasFolder ? t('cancel') : t('notNow'),
                    style: 'cancel'
                },
                {
                    text: hasFolder ? t('changeFolder') : t('selectFolder'),
                    onPress: async () => {
                        try {
                            const folderUri = await requestDirectoryPermissions();
                            if (folderUri) {
                                await savePlatformFolder(currentPlatform.slug, currentPlatform.name, folderUri);
                                if (roms.length > 0) {
                                    if (currentPlatform) {
                                        const folder = await getPlatformFolder(currentPlatform.slug);
                                        await checkMultipleRoms(roms, folder?.folderUri || '');
                                    }
                                }
                                showSuccessToast(
                                    t('folderConfiguredSuccessfully', { platform: currentPlatform.name }),
                                    t('folderConfigured')
                                );
                            }
                        } catch (error) {
                            console.error('Error selecting folder:', error);
                            showErrorToast(
                                t('errorSelectingFolder'),
                                t('error')
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
                await fetchPlatform(platformId);
                await fetchRomsByPlatform(platformId);
                console.log('Refreshing ROMs and platform data');

                // Force a complete refresh of ROM checks
                setTimeout(async () => {
                    if (currentPlatform && roms.length > 0) {
                        console.log('Force refreshing all ROM checks');
                        for (const rom of roms) {
                            await refreshRomCheck(rom);
                        }
                        console.log('All ROM checks refreshed');
                    }
                }, 500); // Small delay to ensure data is updated
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
            showErrorToast(
                t('errorRefreshingData'),
                t('error')
            );
        } finally {
            setRefreshing(false);
        }
    };

    const handleDownloadAll = async () => {
        if (!currentPlatform || roms.length === 0) {
            showErrorToast(t('noRomsAvailable'), t('error'));
            return;
        }

        // Get the platform folder
        const platformFolder = await getPlatformFolder(currentPlatform.slug);
        if (!platformFolder) {
            Alert.alert(
                t('folderNotSelected'),
                t('selectFolderFirst', { platform: currentPlatform.name }),
                [
                    { text: t('cancel'), style: 'cancel' },
                    { text: t('selectFolder'), onPress: () => showFolderSelectionDialog() }
                ]
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
            t('downloadAllRomsQuestion', { count: romsToDownload.length.toString(), platform: currentPlatform.name }),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('downloadAll'),
                    onPress: async () => {
                        setIsDownloadingAll(true);
                        try {
                            // Add all ROMs to download queue
                            romsToDownload.forEach(rom => {
                                addToQueue(rom, platformFolder);
                            });

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

    // Show error if API call fails
    useEffect(() => {
        const error = romsError || platformError;
        if (error) {
            showErrorToast(
                t('unableToLoadPlatformData'),
                t('error')
            );
        }
    }, [romsError, platformError, showErrorToast, t]);

    const handleDownload = async (rom: Rom) => {
        if (!currentPlatform) return;

        // Get the platform folder
        const platformFolder = await getPlatformFolder(currentPlatform.slug);
        if (!platformFolder) {
            Alert.alert(
                t('folderNotSelected'),
                t('selectFolderForDownload', { platform: currentPlatform.name }),
                [
                    { text: t('cancel'), style: 'cancel' },
                    { text: t('selectFolder'), onPress: () => showFolderSelectionDialog() }
                ]
            );
            return;
        }

        addToQueue(rom, platformFolder);
    };

    const GameCard = ({ rom }: { rom: Rom & { isEmpty?: boolean } }) => {
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
                            <Ionicons name="help-outline" size={Math.min(64, cardWidth * 0.4)} color="#666" />
                            <Text style={[styles.gameTitle, { fontSize: Math.min(14, cardWidth * 0.1) }]} numberOfLines={2}>
                                {rom.name || rom.fs_name}
                            </Text>
                        </View>
                    )}
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

    if (romsLoading || platformLoading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>{t('loading')}</Text>
            </View>
        );
    }

    if (!platformId || isNaN(platformId) || !currentPlatform) {
        return (
            <View style={[styles.container, styles.centered]}>
                <Text style={styles.errorText}>{t('platformNotFound')}</Text>
            </View>
        );
    }

    // Calculate available ROMs to download
    const availableToDownload = roms.filter(rom => !isDownloading(rom.id) && !isRomDownloaded(rom.id)).length;

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

    return (
        <View style={styles.container}>
            {/* Header Section */}
            <View style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity style={styles.backButton} onPress={navigation.goBack}>
                        <Ionicons name="arrow-back-outline" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerLeft}>
                        <Text style={styles.headerTitle}>{currentPlatform?.name || t('unknownPlatform')}</Text>
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
            <FlatList
                data={prepareGridData(roms)}
                renderItem={({ item }) => <GameCard rom={item} />}
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
                        tintColor="#fff"
                        colors={['#007AFF']}
                        progressBackgroundColor="#333"
                    />
                }
                ListEmptyComponent={
                    !romsLoading && !platformLoading ? (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="game-controller-outline" size={64} color="#666" />
                            <Text style={styles.emptyText}>{t('noRomsFoundForPlatform')}</Text>
                        </View>
                    ) : null
                }
            />

            <DownloadStatusBar onPress={() => router.push('/downloads')} />
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
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    row: {
        justifyContent: 'space-between',
        paddingHorizontal: 0,
        marginBottom: 15,
    },
    gameCard: {
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
    placeholderContainer: {
        width: '100%',
        height: '100%',
        backgroundColor: '#222',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 8,
    },
    placeholderTitle: {
        color: '#ccc',
        fontSize: 10,
        fontWeight: '500',
        textAlign: 'center',
        lineHeight: 12,
        marginTop: 4,
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
        bottom: 8,
        right: 8,
    },
    downloadButton: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
});