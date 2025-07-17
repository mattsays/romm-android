import { useRomDownload } from '@/hooks/useRomDownload';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useDownload } from '../contexts/DownloadContext';
import { useToast } from '../contexts/ToastContext';
import { useDynamicColumns } from '../hooks/useDynamicColumns';
import { useRomFileSystem } from '../hooks/useRomFileSystem';
import { useRomsSearch } from '../hooks/useRoms';
import { useTranslation } from '../hooks/useTranslation';
import { Rom, SearchOrderCriteria, SearchOrderDirection } from '../services/api';

interface SortOption {
    key: SearchOrderCriteria;
    label: string;
}

interface DirectionOption {
    key: SearchOrderDirection;
    label: string;
}

export default function SearchScreen() {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const [showSortModal, setShowSortModal] = useState(false);
    const [sortBy, setSortBy] = useState<SearchOrderCriteria>('name');
    const [sortDirection, setSortDirection] = useState<SearchOrderDirection>('asc');
    const { showErrorToast, showInfoToast } = useToast();
    const { downloadRom } = useRomDownload();
    const { completedDownloads, isDownloading } = useDownload();
    const { isRomDownloaded, isCheckingRom, refreshRomCheck } = useRomFileSystem();
    const { columns, cardWidth, isLandscape } = useDynamicColumns();
    const {
        roms: searchResults,
        loading,
        loadingMore,
        hasMore,
        total,
        searchPerformed,
        error,
        searchRoms: performSearch,
        loadMoreRoms,
        clearSearch: clearSearchResults
    } = useRomsSearch();
    const insets = useSafeAreaInsets();

    const sortOptions: SortOption[] = [
        { key: 'name', label: t('sortByName') },
        { key: 'fs_size_bytes', label: t('sortBySize') },
        { key: 'created_at', label: t('sortByDateAdded') },
        { key: 'first_release_date', label: t('sortByReleaseDate') },
        { key: 'average_rating', label: t('sortByRating') },
    ];

    const directionOptions: DirectionOption[] = [
        { key: 'asc', label: t('sortAscending') },
        { key: 'desc', label: t('sortDescending') },
    ];

    const handleSearch = useCallback(() => {
        if (searchQuery.trim()) {
            performSearch(searchQuery, sortBy, sortDirection);
        }
    }, [searchQuery, sortBy, sortDirection]);

    // Monitor search results to refresh ROM status
    useEffect(() => {
        if (searchResults.length > 0) {
            Promise.all(searchResults.map(rom => refreshRomCheck(rom)));
        }
    }, [searchResults.length, completedDownloads.length]);

    // Show error if search fails
    useEffect(() => {
        if (error) {
            showErrorToast(
                error,
                t('search')
            );
        }
    }, [error, showErrorToast, t]);

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

    const clearSearch = () => {
        setSearchQuery('');
        clearSearchResults();
    };

    const applySortAndSearch = (newSortBy: SearchOrderCriteria, newSortDirection: SearchOrderDirection) => {
        setSortBy(newSortBy);
        setSortDirection(newSortDirection);
        setShowSortModal(false);

        if (searchQuery.trim()) {
            performSearch(searchQuery, newSortBy, newSortDirection);
        }
    };

    // Auto-search when user stops typing
    useEffect(() => {
        const debounceTimer = setTimeout(() => {
            if (searchQuery.trim().length >= 2) {
                handleSearch();
            } else if (searchQuery.trim().length === 0) {
                clearSearch();
            }
        }, 500);

        return () => clearTimeout(debounceTimer);
    }, [searchQuery, handleSearch]);

    // Handle end reached for infinite scroll
    const handleEndReached = () => {
        if (hasMore && !loadingMore && !loading && searchPerformed) {
            console.log('Loading more search results...');
            loadMoreRoms();
        }
    };

    // Footer component for loading more items
    const renderFooter = () => {
        if (!loadingMore) return null;

        return (
            <View style={styles.loadingFooter}>
                <ActivityIndicator size="small" color="#5f43b2" />
                <Text style={styles.loadingFooterText}>{t('loadingMore')}</Text>
            </View>
        );
    };

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

    const RomCard = ({ rom }: { rom: Rom & { isEmpty?: boolean } }) => {
        if (rom.isEmpty) {
            return <View style={[styles.romCard, { width: cardWidth }]} />;
        }

        // Calculate card height based on width to maintain aspect ratio
        const cardHeight = Math.floor(cardWidth * 1.4); // 1.4 aspect ratio

        return (
            <TouchableOpacity
                style={[styles.romCard, { width: cardWidth }]}
                activeOpacity={0.8}
                onPress={() => router.push(`/game/${rom.id}`)}
            >
                <View style={[styles.romImageContainer, { height: cardHeight }]}>
                    {rom.url_cover ? (
                        <Image
                            source={{ uri: rom.url_cover }}
                            style={styles.romImage}
                        />
                    ) : (
                        <View style={styles.romPlaceholder}>
                            <Ionicons name="game-controller-outline" size={Math.min(32, cardWidth * 0.25)} color="#666" />
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
                <View style={styles.romInfo}>
                    <Text style={[styles.romName, { fontSize: Math.min(14, cardWidth * 0.1) }]} numberOfLines={2}>
                        {rom.name}
                    </Text>
                    <Text style={[styles.romPlatform, { fontSize: Math.min(12, cardWidth * 0.08) }]} numberOfLines={1}>
                        {rom.platform_name}
                    </Text>
                    <Text style={[styles.romSize, { fontSize: Math.min(11, cardWidth * 0.075) }]} numberOfLines={1}>
                        {(rom.fs_size_bytes / (1024 * 1024)).toFixed(1)} MB
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    const SortModal = () => (
        <Modal
            visible={showSortModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowSortModal(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>{t('sortBy')}</Text>
                        <TouchableOpacity
                            onPress={() => setShowSortModal(false)}
                            style={styles.modalCloseButton}
                        >
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionTitle}>Criterio</Text>
                    {sortOptions.map((option) => (
                        <TouchableOpacity
                            key={option.key}
                            style={[
                                styles.sortOption,
                                sortBy === option.key && styles.sortOptionSelected
                            ]}
                            onPress={() => applySortAndSearch(option.key, sortDirection)}
                        >
                            <Text style={[
                                styles.sortOptionText,
                                sortBy === option.key && styles.sortOptionTextSelected
                            ]}>
                                {option.label}
                            </Text>
                            {sortBy === option.key && (
                                <Ionicons name="checkmark" size={20} color="#5f43b2" />
                            )}
                        </TouchableOpacity>
                    ))}

                    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Direzione</Text>
                    {directionOptions.map((option) => (
                        <TouchableOpacity
                            key={option.key}
                            style={[
                                styles.sortOption,
                                sortDirection === option.key && styles.sortOptionSelected
                            ]}
                            onPress={() => applySortAndSearch(sortBy, option.key)}
                        >
                            <Text style={[
                                styles.sortOptionText,
                                sortDirection === option.key && styles.sortOptionTextSelected
                            ]}>
                                {option.label}
                            </Text>
                            {sortDirection === option.key && (
                                <Ionicons name="checkmark" size={20} color="#5f43b2" />
                            )}
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </Modal>
    );

    return (
        <ProtectedRoute>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                {/* Header with integrated search bar */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.searchInputContainer}>
                        <Ionicons name="search" size={18} color="#666" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={t('searchPlaceholder')}
                            placeholderTextColor="#666"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            returnKeyType="search"
                            onSubmitEditing={handleSearch}
                            autoFocus
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity
                                style={styles.clearButton}
                                onPress={clearSearch}
                            >
                                <Ionicons name="close-circle" size={18} color="#666" />
                            </TouchableOpacity>
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.sortButton}
                        onPress={() => setShowSortModal(true)}
                    >
                        <Ionicons name="funnel-outline" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Search Results */}
                <View style={styles.resultsContainer}>
                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#5f43b2" />
                            <Text style={styles.loadingText}>{t('loading')}</Text>
                        </View>
                    ) : searchPerformed ? (
                        searchResults.length > 0 ? (
                            <>
                                <Text style={styles.resultsHeader}>
                                    {t('searchResultsFor', { query: searchQuery })} ({total !== null ? `${searchResults.length}/${total}` : searchResults.length})
                                </Text>
                                <FlatList
                                    data={prepareGridData(searchResults)}
                                    renderItem={({ item }) => <RomCard rom={item} />}
                                    keyExtractor={(item) => item.id.toString()}
                                    numColumns={columns}
                                    key={`${columns}-${isLandscape}`} // Force re-render when columns or orientation change
                                    columnWrapperStyle={columns > 1 ? styles.row : undefined}
                                    contentContainerStyle={styles.resultsList}
                                    showsVerticalScrollIndicator={false}
                                    ListFooterComponent={renderFooter}
                                    onEndReached={handleEndReached}
                                    onEndReachedThreshold={0.1}
                                />
                            </>
                        ) : (
                            <View style={styles.emptyContainer}>
                                <Ionicons name="search-outline" size={64} color="#666" />
                                <Text style={styles.emptyText}>{t('noSearchResults')}</Text>
                                <Text style={styles.emptySubtext}>
                                    {t('searchResultsFor', { query: searchQuery })}
                                </Text>
                            </View>
                        )
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search-outline" size={64} color="#666" />
                            <Text style={styles.emptyText}>{t('searchPlaceholder')}</Text>
                            <Text style={styles.emptySubtext}>
                                {t('searchEmptyState')}
                            </Text>
                        </View>
                    )}
                </View>

                <SortModal />
            </View>
        </ProtectedRoute>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        flex: 1,
        textAlign: 'center',
    },
    headerSpacer: {
        width: 40,
    },
    searchContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 16,
        gap: 12,
    },
    searchInputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 2,
        borderWidth: 1,
        borderColor: '#333',
    },
    searchIcon: {
        marginRight: 12,
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
    },
    clearButton: {
        padding: 4,
    },
    sortButton: {
        backgroundColor: '#5f43b2',
        marginLeft: 12,
        paddingHorizontal: 10,
        paddingVertical: 10,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultsContainer: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#fff',
        fontSize: 16,
        marginTop: 10,
    },
    resultsHeader: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 16,
    },
    resultsList: {
        paddingBottom: 20,
    },
    row: {
        justifyContent: 'space-between',
        paddingHorizontal: 0,
        marginBottom: 15,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        color: '#666',
        fontSize: 18,
        textAlign: 'center',
        marginTop: 16,
        fontWeight: '600',
    },
    emptySubtext: {
        color: '#666',
        fontSize: 14,
        textAlign: 'center',
        marginTop: 8,
    },
    romCard: {
        marginBottom: 15,
        backgroundColor: '#111',
        borderRadius: 12,
        overflow: 'hidden',
    },
    romImageContainer: {
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
        fontWeight: '600',
        marginBottom: 4,
    },
    romPlatform: {
        color: '#999',
        marginBottom: 2,
    },
    romSize: {
        color: '#666',
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
    completedBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 15,
        padding: 2,
    },
    checkingBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: 'rgba(255, 149, 0, 0.9)',
        borderRadius: 12,
        padding: 4,
    },
    downloadingBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0, 122, 255, 0.9)',
        borderRadius: 12,
        padding: 4,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 20,
        width: '80%',
        maxWidth: 400,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalCloseButton: {
        padding: 4,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 12,
    },
    sortOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 8,
    },
    sortOptionSelected: {
        backgroundColor: '#333',
    },
    sortOptionText: {
        color: '#fff',
        fontSize: 16,
    },
    sortOptionTextSelected: {
        color: '#5f43b2',
        fontWeight: '600',
    },
    loadingFooter: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 20,
        gap: 10,
    },
    loadingFooterText: {
        color: '#999',
        fontSize: 14,
    },
});
