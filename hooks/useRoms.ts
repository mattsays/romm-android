import { useCallback, useEffect, useState } from 'react';
import { apiClient, Platform, Rom } from '../services/api';

interface UseRomsState {
    roms: Rom[];
    loading: boolean;
    error: string | null;
}

interface UseRomsReturn extends UseRomsState {
    fetchRomsByPlatform: (platformId: number) => Promise<void>;
    refreshRoms: () => Promise<void>;
    clearRoms: () => void;
}

export function useRoms(): UseRomsReturn {
    const [state, setState] = useState<UseRomsState>({
        roms: [],
        loading: false,
        error: null,
    });

    const [currentPlatformId, setCurrentPlatformId] = useState<number | null>(null);

    const fetchRomsByPlatform = useCallback(async (platformId: number) => {
        setState(prev => ({ ...prev, loading: true, error: null }));
        setCurrentPlatformId(platformId);
        try {
            const roms = await apiClient.getRomsByPlatform(platformId);
            setState(prev => ({
                ...prev,
                roms,
                loading: false
            }));
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to fetch ROMs';
            setState(prev => ({
                ...prev,
                loading: false,
                error: errorMessage
            }));
            console.error('Error fetching ROMs:', error);
        }
    }, []);

    const refreshRoms = useCallback(async () => {
        if (currentPlatformId !== null) {
            await fetchRomsByPlatform(currentPlatformId);
        }
    }, [currentPlatformId, fetchRomsByPlatform]);

    const clearRoms = useCallback(() => {
        setState({
            roms: [],
            loading: false,
            error: null,
        });
        setCurrentPlatformId(null);
    }, []);

    return {
        ...state,
        fetchRomsByPlatform,
        refreshRoms,
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
