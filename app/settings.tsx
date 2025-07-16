import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect } from 'react';
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
    const { t, locale, changeLanguage, supportedLocales, isLoading } = useTranslation();
    const { requestDirectoryPermissions } = useStorageAccessFramework();
    const {
        savePlatformFolder,
        removePlatformFolder,
        removeAllPlatformFolders,
        loadPlatformFolders,
        platformFolders
    } = usePlatformFolders();

    const changePlatformFolder = async (platformSlug: string, platformName: string) => {
        try {
            const folderUri = await requestDirectoryPermissions();

            if (folderUri) {
                await savePlatformFolder(platformSlug, platformName, folderUri);

                Alert.alert(
                    t('success'),
                    t('folderUpdatedForPlatform', { platform: platformName }),
                    [{ text: t('ok') }]
                );
            }
        } catch (error) {
            console.error('Error selecting folder:', error);
            Alert.alert(
                t('error'),
                t('cannotSelectFolder'),
                [{ text: t('ok') }]
            );
        }
    };

    const changeLanguageWithFeedback = async (newLocale: any) => {
        await changeLanguage(newLocale);
        Alert.alert(
            t('success'),
            t('languageChanged'),
            [{ text: t('ok') }]
        );
    };

    const removePlatformFolderConfirm = async (platformSlug: string, platformName: string) => {
    };

    const removeAllPlatformFoldersConfirm = async () => {
        Alert.alert(
            t('confirm'),
            t('confirmRemoveAllPlatformFolders'),
            [
                {
                    text: t('cancel'),
                    style: 'cancel',
                },
                {
                    text: t('removeAll'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await removeAllPlatformFolders();
                            Alert.alert(
                                t('success'),
                                t('allPlatformFoldersRemoved'),
                                [{ text: t('ok') }]
                            );
                        } catch (error) {
                            console.error('Error removing all folders:', error);
                            Alert.alert(
                                t('error'),
                                t('cannotRemoveAllFolders'),
                                [{ text: t('ok') }]
                            );
                        }
                    },
                },
            ]
        );
    };

    useEffect(() => {
        // Load configured platforms when the component mounts
        loadPlatformFolders();
    }, []);

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
                    <Text style={styles.sectionTitle}>{t('platformFolders')}</Text>
                    <Text style={styles.sectionDescription}>
                        {t('platformFoldersDescription')}
                    </Text>

                    {platformFolders.length > 0 ? (
                        <View>
                            {platformFolders.map((platform) => (
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
                                            <Text style={styles.buttonText}>{t('change')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.button, styles.removeButton]}
                                            onPress={() => removePlatformFolderConfirm(platform.platformSlug, platform.platformName)}
                                        >
                                            <Ionicons name="trash-outline" size={20} color="#fff" />
                                            <Text style={styles.buttonText}>{t('remove')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}

                            {/* Remove All Button */}
                            <TouchableOpacity
                                style={[styles.button, styles.removeAllButton]}
                                onPress={removeAllPlatformFoldersConfirm}
                            >
                                <Ionicons name="trash-bin-outline" size={20} color="#fff" />
                                <Text style={styles.buttonText}>{t('removeAllPlatformFolders')}</Text>
                            </TouchableOpacity>

                        </View>
                    ) : (
                        <View>
                            <Text style={styles.noFoldersText}>
                                {t('noPlatformFolders')}
                            </Text>
                        </View>
                    )}

                </View>

                {/* Language Selection Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('language')}</Text>
                    <Text style={styles.sectionDescription}>
                        {t('languageDescription')}
                    </Text>

                    <View style={styles.languageGrid}>
                        {isLoading ? (
                            <Text style={styles.noFoldersText}>{t('loading')}</Text>
                        ) : (
                            supportedLocales.map((localeCode) => (
                                <TouchableOpacity
                                    key={localeCode}
                                    style={[
                                        styles.languageButton,
                                        locale === localeCode && styles.languageButtonActive
                                    ]}
                                    onPress={() => changeLanguageWithFeedback(localeCode)}
                                >
                                    <Text style={[
                                        styles.languageText,
                                        locale === localeCode && styles.languageTextActive
                                    ]}>
                                        {getLanguageName(localeCode)}
                                    </Text>
                                    <Text style={[
                                        styles.languageNativeText,
                                        locale === localeCode && styles.languageNativeTextActive
                                    ]}>
                                        {getLanguageNativeName(localeCode)}
                                    </Text>
                                    {locale === localeCode && (
                                        <Ionicons name="checkmark-circle" size={18} color="#4CAF50" style={styles.checkIcon} />
                                    )}
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </View>

            </ScrollView>
        </View>
    );
}

// Helper functions for language names
function getLanguageName(locale: string): string {
    const names: Record<string, string> = {
        'en': 'English',
        'it': 'Italian',
        'fr': 'French',
        'es': 'Spanish',
        'de': 'German',
        'pt': 'Portuguese',
        'ja': 'Japanese',
        'ru': 'Russian',
        'nl': 'Dutch',
    };
    return names[locale] || locale;
}

function getLanguageNativeName(locale: string): string {
    const nativeNames: Record<string, string> = {
        'en': 'English',
        'it': 'Italiano',
        'fr': 'Français',
        'es': 'Español',
        'de': 'Deutsch',
        'pt': 'Português',
        'ja': '日本語',
        'ru': 'Русский',
        'nl': 'Nederlands',
    };
    return nativeNames[locale] || locale;
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
    removeAllButton: {
        backgroundColor: '#FF3B30',
        marginTop: 16,
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
    languageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 12,
    },
    languageButton: {
        backgroundColor: '#2C2C2E',
        borderRadius: 12,
        padding: 16,
        minWidth: '47%',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'transparent',
        position: 'relative',
    },
    languageButtonActive: {
        backgroundColor: '#1C4B3A',
        borderColor: '#4CAF50',
    },
    languageText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
    },
    languageTextActive: {
        color: '#4CAF50',
    },
    languageNativeText: {
        color: '#ccc',
        fontSize: 12,
    },
    languageNativeTextActive: {
        color: '#81C995',
    },
    checkIcon: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
});
