import { useCallback, useEffect, useState } from 'react';
import { apiClient, Platform, Rom } from '../services/api';

interface UseRomsState {
    roms: Rom[];
    loading: boolean;
    loadingMore: boolean;
    error: string | null;
    hasMore: boolean;
    total: number | null;
}

interface UseRomsReturn extends UseRomsState {
    recentlyAddedRoms: Rom[];
    fetchRomsByPlatform: (platformId: number) => Promise<void>;
    loadMoreRoms: () => Promise<void>;
    refreshRoms: () => Promise<void>;
    fetchRecentlyAddedRoms: () => Promise<Rom[]>;
    clearRoms: () => void;
}

export function useRoms(): UseRomsReturn {
    const [state, setState] = useState<UseRomsState>({
        roms: [],
        loading: false,
        loadingMore: false,
        error: null,
        hasMore: true,
        total: null,
    });

    const [recentlyAddedRoms, setRecentlyAddedRoms] = useState<Rom[]>([]);
    const [currentPlatformId, setCurrentPlatformId] = useState<number | null>(null);
    const [offset, setOffset] = useState(0);

    const ITEMS_PER_PAGE = 20;

    const fetchRomsByPlatform = useCallback(async (platformId: number, reset: boolean = true) => {
        try {
            const currentOffset = reset ? 0 : offset;

            if (reset) {
                setState(prev => ({ ...prev, loading: true, error: null, roms: [], hasMore: true, total: null }));
                setOffset(0);
                setCurrentPlatformId(platformId);
            } else {
                setState(prev => ({ ...prev, loadingMore: true }));
            }

            const response = await apiClient.getRomsByPlatform(platformId, ITEMS_PER_PAGE, currentOffset);
            const newItems = response.items || [];
            const newRoms = reset ? newItems : [...state.roms, ...newItems];

            setState(prev => ({
                ...prev,
                roms: newRoms,
                loading: false,
                loadingMore: false,
                total: response.total || null,
                hasMore: (response.total || 0) > newRoms.length && newItems.length === ITEMS_PER_PAGE
            }));

            setOffset(reset ? newItems.length : offset + newItems.length);

            console.log(`Loaded ${newItems.length} ROMs for platform ${platformId}, total: ${reset ? newItems.length : state.roms.length + newItems.length}/${response.total || 0}`);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch ROMs';
            setState(prev => ({
                ...prev,
                loading: false,
                loadingMore: false,
                error: errorMessage
            }));
            console.error('Error fetching ROMs:', error);
        }
    }, [offset, state.roms.length]);

    const loadMoreRoms = useCallback(async () => {
        if (currentPlatformId !== null && state.hasMore && !state.loadingMore && !state.loading) {
            console.log('Loading more ROMs for platform, current offset:', offset);
            await fetchRomsByPlatform(currentPlatformId, false);
        }
    }, [currentPlatformId, state.hasMore, state.loadingMore, state.loading, offset, fetchRomsByPlatform]);

    const refreshRoms = useCallback(async () => {
        if (currentPlatformId !== null) {
            console.log('Refreshing ROMs for platform from beginning');
            await fetchRomsByPlatform(currentPlatformId, true);
        }
    }, [currentPlatformId, fetchRomsByPlatform]);

    const clearRoms = useCallback(() => {
        setState({
            roms: [],
            loading: false,
            loadingMore: false,
            error: null,
            hasMore: true,
            total: null,
        });
        setCurrentPlatformId(null);
        setOffset(0);
    }, []);

    const fetchRecentlyAddedRoms = useCallback(async () => {
        try {
            const roms = await apiClient.getRomsRecentlyAdded();
            setRecentlyAddedRoms(roms);
            return roms;
        } catch (error) {
            console.error('Error fetching recently added ROMs:', error);
            return [];
        }
    }, []);

    // Reset state when platform changes
    useEffect(() => {
        return () => {
            setState(prev => ({
                ...prev,
                roms: [],
                loading: false,
                loadingMore: false,
                error: null,
                hasMore: true,
                total: null,
            }));
            setOffset(0);
        };
    }, [currentPlatformId]);

    return {
        ...state,
        recentlyAddedRoms,
        fetchRomsByPlatform: (platformId: number) => fetchRomsByPlatform(platformId, true),
        loadMoreRoms,
        refreshRoms,
        fetchRecentlyAddedRoms,
        clearRoms,
    };
}

// Hook for platforms
interface UsePlatformsState {
    platforms: Platform[];
    loading: boolean;
    error: string | null;
}

interface UsePlatformsReturn extends UsePlatformsState {
    fetchPlatforms: () => Promise<void>;
    refreshPlatforms: () => Promise<void>;
}

export function usePlatforms(autoFetch: boolean = false): UsePlatformsReturn {
    const [state, setState] = useState<UsePlatformsState>({
        platforms: [],
        loading: false,
        error: null,
    });

    const fetchPlatforms = useCallback(async () => {
        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            const platforms = await apiClient.getPlatforms();
            setState(prev => ({
                ...prev,
                platforms,
                loading: false
            }));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch platforms';
            setState(prev => ({
                ...prev,
                loading: false,
                error: errorMessage
            }));
            console.error('Error fetching platforms:', error);
        }
    }, []);

    const refreshPlatforms = useCallback(async () => {
        await fetchPlatforms();
    }, [fetchPlatforms]);

    // Automatically fetch platforms on mount only if autoFetch is true
    useEffect(() => {
        if (autoFetch) {
            fetchPlatforms();
        }
    }, [fetchPlatforms, autoFetch]);

    return {
        ...state,
        fetchPlatforms,
        refreshPlatforms,
    };
}

// Hook for single platform
interface UsePlatformState {
    platform: Platform | null;
    loading: boolean;
    error: string | null;
}

interface UsePlatformReturn extends UsePlatformState {
    fetchPlatform: (platformId: number) => Promise<void>;
    refreshPlatform: () => Promise<void>;
    clearPlatform: () => void;
}

export function usePlatform(): UsePlatformReturn {
    const [state, setState] = useState<UsePlatformState>({
        platform: null,
        loading: false,
        error: null,
    });

    const [currentPlatformId, setCurrentPlatformId] = useState<number | null>(null);

    const fetchPlatform = useCallback(async (platformId: number) => {
        setState(prev => ({ ...prev, loading: true, error: null }));
        setCurrentPlatformId(platformId);
        try {
            const platform = await apiClient.getPlatform(platformId);
            setState(prev => ({
                ...prev,
                platform,
                loading: false
            }));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch platform';
            setState(prev => ({
                ...prev,
                loading: false,
                error: errorMessage
            }));
            console.error('Error fetching platform:', error);
        }
    }, []);

    const refreshPlatform = useCallback(async () => {
        if (currentPlatformId !== null) {
            await fetchPlatform(currentPlatformId);
        }
    }, [currentPlatformId, fetchPlatform]);

    const clearPlatform = useCallback(() => {
        setState({
            platform: null,
            loading: false,
            error: null,
        });
        setCurrentPlatformId(null);
    }, []);

    return {
        ...state,
        fetchPlatform,
        refreshPlatform,
        clearPlatform,
    };
}

export function useRomsByCollection(collectionId: string, isVirtual: boolean, autoFetch: boolean = true) {
    const [roms, setRoms] = useState<Rom[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [offset, setOffset] = useState(0);
    const [total, setTotal] = useState<number | null>(null);

    const ITEMS_PER_PAGE = 20;

    const fetchRoms = useCallback(async (reset: boolean = true) => {
        try {
            const currentOffset = reset ? 0 : offset;

            if (reset) {
                setLoading(true);
                setRoms([]);
                setOffset(0);
                setHasMore(true);
                setTotal(null);
            } else {
                setLoadingMore(true);
            }

            setError(null);

            const response = await apiClient.getRomsByCollection(
                collectionId,
                isVirtual,
                ITEMS_PER_PAGE,
                currentOffset
            );

            const newItems = response.items || [];

            if (reset) {
                setRoms(newItems);
                setOffset(newItems.length);
            } else {
                setRoms(prev => [...prev, ...newItems]);
                setOffset(prev => prev + newItems.length);
            }

            setTotal(response.total || null);

            // Check if there are more items to load
            const totalItems = response.total || 0;
            const loadedItems = reset ? newItems.length : roms.length + newItems.length;
            setHasMore(loadedItems < totalItems && newItems.length === ITEMS_PER_PAGE);

            console.log(`Loaded ${newItems.length} ROMs, total: ${loadedItems}/${totalItems}, hasMore: ${loadedItems < totalItems && newItems.length === ITEMS_PER_PAGE}`);

        } catch (err) {
            console.error('Error fetching collection roms:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
            if (reset) {
                setRoms([]);
            }
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [collectionId, isVirtual, offset, roms.length]);

    const loadMoreRoms = useCallback(async () => {
        if (!loadingMore && hasMore && !loading) {
            console.log('Loading more ROMs, current offset:', offset);
            await fetchRoms(false);
        }
    }, [fetchRoms, loadingMore, hasMore, loading, offset]);

    const refreshRoms = useCallback(async () => {
        console.log('Refreshing ROMs from beginning');
        await fetchRoms(true);
    }, [fetchRoms]);

    // Reset state when collection changes
    useEffect(() => {
        setRoms([]);
        setLoading(false);
        setLoadingMore(false);
        setError(null);
        setHasMore(true);
        setOffset(0);
        setTotal(null);
    }, [collectionId, isVirtual]);

    useEffect(() => {
        if (autoFetch && collectionId) {
            fetchRoms(true);
        }
    }, [autoFetch, collectionId]);

    return {
        roms,
        loading,
        loadingMore,
        error,
        hasMore,
        total,
        fetchRoms: refreshRoms,
        loadMoreRoms,
    };
}
