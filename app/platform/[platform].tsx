import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import React, { useEffect } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { usePlatform, useRoms } from '../../hooks/useRoms';
import { useTranslation } from '../../hooks/useTranslation';
import { apiClient, Rom } from '../../services/api';

const { width } = Dimensions.get('window');

export default function LibraryScreen() {
    const { platform } = useLocalSearchParams();
    const navigation = useNavigation();
    const { t } = useTranslation();
    const { roms, loading: romsLoading, error: romsError, fetchRomsByPlatform } = useRoms();
    const { platform: currentPlatform, loading: platformLoading, error: platformError, fetchPlatform } = usePlatform();

    console.log('Platform ID:', platform);
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
                        uri: rom.url_cover || `${apiClient.baseUrl} /assets/isotipo.png`
                    }}
                    style={styles.gameImage}
                />
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
                </View>
            </View>

            {/* Games Grid */}
            <ScrollView style={styles.gamesContainer} showsVerticalScrollIndicator={false}>
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
    headerTitle: {
        color: '#fff',
        fontSize: 32,
        fontWeight: 'bold',
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