import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuthCheck, useLogout } from '../hooks/useAuth';
import { usePlatforms } from '../hooks/useRoms';
import { useTranslation } from '../hooks/useTranslation';
import { apiClient, Platform as ApiPlatform } from '../services/api';

const { width } = Dimensions.get('window');

export default function LibraryScreen() {
    const { t } = useTranslation();
    const { platforms, loading, error, fetchPlatforms } = usePlatforms(false); // Don't auto-fetch
    const { user, username, isAuthenticated } = useAuthCheck();
    const { logout, isLoading: isLoggingOut } = useLogout();
    const [refreshing, setRefreshing] = useState(false);

    // Funzione per il refresh
    const onRefresh = async () => {
        setRefreshing(true);
        try {
            await fetchPlatforms();
        } catch (error) {
            console.error('Errore durante il refresh:', error);
        } finally {
            setRefreshing(false);
        }
    };

    // Fetch platforms only after authentication is verified
    useEffect(() => {
        console.log('isAuthenticated:', isAuthenticated);
        if (isAuthenticated) {
            fetchPlatforms();
        }
    }, [isAuthenticated, fetchPlatforms]);

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Sei sicuro di voler uscire?',
            [
                {
                    text: 'Annulla',
                    style: 'cancel',
                },
                {
                    text: 'Esci',
                    style: 'destructive',
                    onPress: async () => {
                        try {
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
        if (error) {
            Alert.alert(
                'Errore',
                'Impossibile caricare le piattaforme. Controlla la connessione di rete.',
                [{ text: 'OK' }]
            );
        }
    }, [error]);

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
                    {platform.rom_count} giochi
                </Text>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={styles.loadingText}>Caricamento piattaforme...</Text>
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
                            title="Aggiornamento..." // iOS
                            titleColor="#fff" // iOS
                        />
                    }
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerTop}>
                            <View style={styles.headerLeft}>
                                <Text style={styles.headerTitle}>Libreria</Text>
                                {username && (
                                    <Text style={styles.welcomeText}>
                                        Benvenuto, {username}
                                    </Text>
                                )}
                            </View>
                            <View style={styles.headerButtons}>
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


                    {/* Platforms Grid */}
                    <View style={styles.platformsContainer}>
                        <Text style={styles.sectionTitle}>Piattaforme</Text>
                        <View style={styles.platformsGrid}>
                            {platforms.map((platform) => (
                                <PlatformCard key={platform.id} platform={platform} />
                            ))}
                            {platforms.length === 0 && !loading && (
                                <View style={styles.emptyContainer}>
                                    <Ionicons name="game-controller-outline" size={64} color="#666" />
                                    <Text style={styles.emptyText}>Nessuna piattaforma disponibile</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </ScrollView>
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
    sectionTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
    },
    platformsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    platformCard: {
        width: (width - 60) / 4,
        marginBottom: 20,
        backgroundColor: '#111',
        borderRadius: 12,
        overflow: 'hidden',
    },
    platformImageContainer: {
        position: 'relative',
        height: 120,
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
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    gamesCount: {
        color: '#999',
        fontSize: 12,
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
});