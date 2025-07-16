import { useCallback, useEffect, useState } from 'react';
import { Collection, CollectionType, apiClient } from '../services/api';
import { useTranslation } from './useTranslation';

export function useCollections(autoFetch: boolean = true) {
    const [userCollections, setUserCollections] = useState<Collection[]>([]);
    const [generatedCollections, setGeneratedCollections] = useState<Record<CollectionType, Collection[]>>();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { t } = useTranslation();

    const fetchCollections = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setUserCollections(await apiClient.getUserCollections());
            setGeneratedCollections(await apiClient.getAllVirtualCollections());
        } catch (err) {
            console.error('Error fetching collections:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, []);

    const getCollectionTypeName = useCallback((type: CollectionType): string => {
        switch (type) {
            case 'collection':
                return t('collectiontype_collections');
            case 'franchise':
                return t('collectiontype_franchise');
            case 'genre':
                return t('collectiontype_genre');
            case 'company':
                return t('collectiontype_company');
            case 'mode':
                return t('collectiontype_mode');
            default:
                return t('collectiontype_unknown');
        }
    }, [t]);

    useEffect(() => {
        if (autoFetch) {
            fetchCollections();
        }
    }, [autoFetch, fetchCollections]);

    return {
        userCollections,
        generatedCollections,
        loading,
        error,
        fetchCollections,
        getCollectionTypeName
    };
}

export function useCollection(collectionId: string, isVirtual: boolean) {
    const [collection, setCollection] = useState<Collection | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchCollection = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const collectionData = await apiClient.getCollection(collectionId, isVirtual);
            setCollection(collectionData);
        } catch (err) {
            console.error('Error fetching collection:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        } finally {
            setLoading(false);
        }
    }, [collectionId]);

    useEffect(() => {
        if (collectionId) {
            fetchCollection();
        }
    }, [collectionId, fetchCollection]);

    return {
        collection,
        loading,
        error,
        fetchCollection,
    };
}
