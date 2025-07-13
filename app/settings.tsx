import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { usePlatformFolders } from '../hooks/usePlatformFolders';
import { useStorageAccessFramework } from '../hooks/useStorageAccessFramework';
import { useTranslation } from '../hooks/useTranslation';

export default function SettingsScreen() {
    const { t } = useTranslation();
    const { requestDirectoryPermissions } = useStorageAccessFramework();
    const {
        savePlatformFolder,
        removePlatformFolder,
        getAllConfiguredPlatforms,
        loadPlatformFolders
    } = usePlatformFolders();

    // Ricarica le informazioni delle cartelle quando il componente viene montato
    React.useEffect(() => {
        loadPlatformFolders();
    }, []);

    const changePlatformFolder = async (platformSlug: string, platformName: string) => {
        try {
            const folderUri = await requestDirectoryPermissions();

            if (folderUri) {
                await savePlatformFolder(platformSlug, platformName, folderUri);

                Alert.alert(
                    t('success'),
                    `Cartella aggiornata per la piattaforma ${platformName}`,
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Errore nella selezione della cartella:', error);
            Alert.alert(
                t('error'),
                t('cannotSelectFolder'),
                [{ text: 'OK' }]
            );
        }
    };

    const removePlatformFolderConfirm = async (platformSlug: string, platformName: string) => {
        Alert.alert(
            'Conferma',
            `Vuoi rimuovere la cartella configurata per ${platformName}?`,
            [
                {
                    text: t('cancel'),
                    style: 'cancel',
                },
                {
                    text: t('remove'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await removePlatformFolder(platformSlug);
                        } catch (error) {
                            console.error('Errore nella rimozione della cartella:', error);
                        }
                    },
                },
            ]
        );
    };

    const configuredPlatforms = getAllConfiguredPlatforms();

    return (
        <View style={styles.container}>
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => router.back()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('settings')}</Text>
                </View>

                {/* Platform Folders Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Cartelle Piattaforme</Text>
                    <Text style={styles.sectionDescription}>
                        Configura una cartella specifica per ogni piattaforma di gioco.
                    </Text>

                    {configuredPlatforms.length > 0 ? (
                        <View>
                            {configuredPlatforms.map((platform) => (
                                <View key={platform.platformSlug} style={styles.folderInfo}>
                                    <View style={styles.folderPath}>
                                        <Ionicons name="folder" size={20} color="#4CAF50" />
                                        <View style={styles.folderTextContainer}>
                                            <Text style={styles.platformNameText} numberOfLines={1}>
                                                {platform.platformName}
                                            </Text>
                                            <Text style={styles.folderNameText} numberOfLines={1}>
                                                {platform.folderName}
                                            </Text>
                                            <Text style={styles.folderPathText} numberOfLines={2}>
                                                {decodeURIComponent(platform.folderUri)}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.folderActions}>
                                        <TouchableOpacity
                                            style={[styles.button, styles.changeButton]}
                                            onPress={() => changePlatformFolder(platform.platformSlug, platform.platformName)}
                                        >
                                            <Ionicons name="create-outline" size={20} color="#fff" />
                                            <Text style={styles.buttonText}>Cambia</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.button, styles.removeButton]}
                                            onPress={() => removePlatformFolderConfirm(platform.platformSlug, platform.platformName)}
                                        >
                                            <Ionicons name="trash-outline" size={20} color="#fff" />
                                            <Text style={styles.buttonText}>Rimuovi</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}

                        </View>
                    ) : (
                        <View>
                            <Text style={styles.noFoldersText}>
                                Nessuna cartella configurata. Le cartelle verranno richieste automaticamente quando scarichi la prima ROM di una piattaforma.
                            </Text>
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
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 20,
    },
    backButton: {
        padding: 8,
        marginRight: 16,
        borderRadius: 8,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    section: {
        paddingHorizontal: 20,
        marginBottom: 30,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    sectionDescription: {
        color: '#ccc',
        fontSize: 14,
        marginBottom: 16,
        lineHeight: 20,
    },
    folderInfo: {
        backgroundColor: '#111',
        borderRadius: 12,
        padding: 16,
        marginBottom: 10,
    },
    folderPath: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    folderTextContainer: {
        flex: 1,
        marginLeft: 8,
    },
    folderNameText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    platformNameText: {
        color: '#4CAF50',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 2,
    },
    folderPathText: {
        color: '#ccc',
        fontSize: 12,
        marginBottom: 8,
        lineHeight: 16,
    },
    folderActions: {
        flexDirection: 'row',
        gap: 12,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    selectButton: {
        backgroundColor: '#5f43b2',
    },
    changeButton: {
        backgroundColor: '#FF9500',
        flex: 1,
    },
    removeButton: {
        backgroundColor: '#FF3B30',
        flex: 1,
    },
    addButton: {
        backgroundColor: '#34C759',
        marginTop: 12,
    },
    buttonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    noFoldersText: {
        color: '#666',
        fontSize: 14,
        marginBottom: 16,
        lineHeight: 20,
    },
    placeholderText: {
        color: '#666',
        fontSize: 14,
        fontStyle: 'italic',
    },
});
