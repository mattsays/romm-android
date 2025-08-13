import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useToast } from '../contexts/ToastContext';
import { usePlatformFolders } from '../hooks/usePlatformFolders';
import { useStorageAccessFramework } from '../hooks/useStorageAccessFramework';
import { useTranslation } from '../hooks/useTranslation';
import { version } from '../package.json';
import { Release, updateService } from '../services/updateService';


export default function SettingsScreen() {
    const { t, locale, changeLanguage, supportedLocales, isLoading } = useTranslation();
    const { requestDirectoryPermissions } = useStorageAccessFramework();
    const { showSuccessToast, showErrorToast } = useToast();
    const {
        savePlatformFolder,
        removePlatformFolder,
        removeAllPlatformFolders,
        loadPlatformFolders,
        platformFolders,
        setBaseFolder,
        getBaseFolder,
        removeBaseFolder
    } = usePlatformFolders();
    const [baseFolder, setBaseFolderState] = useState<string | null>(null);
    const [unzipFilesOnDownload, setUnzipFilesOnDownload] = useState<boolean>(true);
    const [concurrentDownloads, setConcurrentDownloads] = useState<number>(2);
    const [showConcurrentDownloadsPicker, setShowConcurrentDownloadsPicker] = useState<boolean>(false);
    const [appUpdatesEnabled, setAppUpdatesEnabled] = useState<boolean>(true);
    const [updateAvailable, setUpdateAvailable] = useState<Release | null>(null);
    const [isCheckingForUpdate, setIsCheckingForUpdate] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);

    const handleCheckForUpdates = async () => {
        if (!appUpdatesEnabled) {
            showErrorToast(t('enableAppUpdates'), t('error'));
            return;
        }

        setIsCheckingForUpdate(true);
        try {
            const release = await updateService.checkForUpdates();
            if (release) {
                setUpdateAvailable(release);
                Alert.alert(
                    t('updateAvailable'),
                    `${release.name}\n\n${release.body}`,
                    [
                        { text: t('cancel'), style: 'cancel' },
                        { text: t('download'), onPress: () => handleDownloadUpdate(release) }
                    ]
                );
            } else {
                showSuccessToast(t('noUpdatesAvailable'), t('upToDate'));
            }
        } catch (error) {
            showErrorToast((error as Error).message, t('updateCheckFailed'));
        } finally {
            setIsCheckingForUpdate(false);
        }
    };

    const handleDownloadUpdate = async (release: Release) => {
        const apkAsset = release.assets.find(asset => asset.name.endsWith('.apk'));
        if (!apkAsset) {
            showErrorToast(t('noApkFound'), t('error'));
            return;
        }

        setIsDownloading(true);
        setDownloadProgress(0);

        try {
            await updateService.downloadUpdate(apkAsset, (progress) => {
                setDownloadProgress(progress);
            });
        } catch (error) {
            showErrorToast((error as Error).message, t('downloadFailed'));
        } finally {
            setIsDownloading(false);
        }
    };

    const changePlatformFolder = async (platformSlug: string, platformName: string) => {
        try {
            const folderUri = await requestDirectoryPermissions();

            if (folderUri) {
                await savePlatformFolder(platformSlug, platformName, folderUri);

                showSuccessToast(
                    t('folderUpdatedForPlatform', { platform: platformName }),
                    t('success')
                );
            }
        } catch (error: any) {
            console.error('Error selecting folder:', error);

            if (error.type === 'permissions_denied') {
                showErrorToast(
                    error.message,
                    t('permissionsNotGranted')
                );
            } else {
                showErrorToast(
                    t('cannotSelectFolder'),
                    t('error')
                );
            }
        }
    };

    const changeLanguageWithFeedback = async (newLocale: any) => {
        await changeLanguage(newLocale);
        showSuccessToast(
            t('languageChanged'),
            t('success')
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
                            showSuccessToast(
                                t('allPlatformFoldersRemoved'),
                                t('success')
                            );
                        } catch (error) {
                            console.error('Error removing all folders:', error);
                            showErrorToast(
                                t('cannotRemoveAllFolders'),
                                t('error')
                            );
                        }
                    },
                },
            ]
        );
    };

    const changeBaseFolder = async () => {
        try {
            const folderUri = await requestDirectoryPermissions();

            if (folderUri) {
                await setBaseFolder(folderUri);
                setBaseFolderState(folderUri);

                showSuccessToast(
                    t('baseFolderConfigured'),
                    t('success')
                );
            }
        } catch (error: any) {
            console.error('Error selecting base folder:', error);

            if (error.type === 'permissions_denied') {
                showErrorToast(
                    error.message,
                    t('permissionsNotGranted')
                );
            } else {
                showErrorToast(
                    error.message || t('errorSelectingFolder'),
                    t('error')
                );
            }
        }
    };

    const handleRemoveBaseFolder = () => {
        Alert.alert(
            t('confirmRemoveFolder'),
            t('confirmRemoveBaseFolder'),
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
                            await removeBaseFolder();
                            setBaseFolderState(null);
                            showSuccessToast(
                                t('baseFolderRemoved'),
                                t('success')
                            );
                        } catch (error) {
                            console.error('Error removing base folder:', error);
                            showErrorToast(
                                t('errorRemovingBaseFolder'),
                                t('error')
                            );
                        }
                    },
                },
            ]
        );
    };

    const loadUnzipSetting = async () => {
        try {
            const value = await AsyncStorage.getItem('unzipFilesOnDownload');
            if (value !== null) {
                setUnzipFilesOnDownload(JSON.parse(value));
            } else {
                // Default value is true
                setUnzipFilesOnDownload(true);
            }
        } catch (error) {
            console.error('Error loading unzip setting:', error);
            setUnzipFilesOnDownload(true); // Default fallback
        }
    };

    const saveUnzipSetting = async (value: boolean) => {
        try {
            await AsyncStorage.setItem('unzipFilesOnDownload', JSON.stringify(value));
            setUnzipFilesOnDownload(value);
            showSuccessToast(
                t('settings') + ' ' + t('success').toLowerCase(),
                t('unzipFiles')
            );
        } catch (error) {
            console.error('Error saving unzip setting:', error);
            showErrorToast(
                t('error'),
                t('settings')
            );
        }
    };

    const loadConcurrentDownloadsSetting = async () => {
        try {
            const value = await AsyncStorage.getItem('concurrentDownloads');
            if (value !== null) {
                const numValue = parseInt(value, 10);
                // Ensure the value is between 1 and 5
                if (numValue >= 1 && numValue <= 5) {
                    setConcurrentDownloads(numValue);
                } else {
                    setConcurrentDownloads(2); // Default fallback
                }
            } else {
                // Default value is 2
                setConcurrentDownloads(2);
            }
        } catch (error) {
            console.error('Error loading concurrent downloads setting:', error);
            setConcurrentDownloads(2); // Default fallback
        }
    };

    const saveConcurrentDownloadsSetting = async (value: number) => {
        try {
            await AsyncStorage.setItem('concurrentDownloads', value.toString());
            setConcurrentDownloads(value);
            showSuccessToast(
                t('settings') + ' ' + t('success').toLowerCase(),
                t('concurrentDownloads')
            );
        } catch (error) {
            console.error('Error saving concurrent downloads setting:', error);
            showErrorToast(
                t('error'),
                t('settings')
            );
        }
    };

    const loadAppUpdatesEnabledSetting = async () => {
        try {
            const value = await AsyncStorage.getItem('appUpdatesEnabled');
            if (value !== null) {
                setAppUpdatesEnabled(JSON.parse(value));
            } else {
                // Default value is true
                setAppUpdatesEnabled(true);
            }
        } catch (error) {
            console.error('Error loading app updates setting:', error);
            setAppUpdatesEnabled(true); // Default fallback
        }
    };

    const saveAppUpdatesEnabledSetting = async (value: boolean) => {
        try {
            await AsyncStorage.setItem('appUpdatesEnabled', JSON.stringify(value));
            setAppUpdatesEnabled(value);
            showSuccessToast(
                t('settings') + ' ' + t('success').toLowerCase(),
                t('appUpdate')
            );
        } catch (error) {
            console.error('Error saving app updates setting:', error);
            showErrorToast(
                t('error'),
                t('settings')
            );
        }
    };

    useEffect(() => {
        // Load configured platforms when the component mounts
        loadPlatformFolders();

        // Load base folder
        const loadBaseFolder = async () => {
            try {
                const folder = await getBaseFolder();
                setBaseFolderState(folder);
            } catch (error) {
                console.error('Error loading base folder:', error);
            }
        };

        loadBaseFolder();

        // Load unzip setting
        loadUnzipSetting();

        // Load concurrent downloads setting
        loadConcurrentDownloadsSetting();

        // Load app updates enabled setting and check for updates on Android
        const loadAndCheckUpdates = async () => {
            await loadAppUpdatesEnabledSetting();

            // Auto-check for updates on startup (Android only)
            if (Platform.OS === 'android') {
                try {
                    const updatesEnabled = await AsyncStorage.getItem('appUpdatesEnabled');
                    const isEnabled = updatesEnabled !== null ? JSON.parse(updatesEnabled) : true;

                    if (isEnabled) {
                        // Check for updates silently in the background
                        const release = await updateService.checkForUpdates();
                        if (release) {
                            setUpdateAvailable(release);
                            // Show a toast notification instead of an immediate alert
                            showSuccessToast(
                                t('updateAvailable'),
                                t('appUpdate')
                            );
                        }
                    }
                } catch (error) {
                    // Silent fail for startup update check
                    console.log('Startup update check failed:', error);
                }
            }
        };

        loadAndCheckUpdates();
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

                {/* Base Folder Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('baseFolder')}</Text>
                    <Text style={styles.sectionDescription}>
                        {t('baseFolderDescription')}
                    </Text>

                    {baseFolder ? (
                        <View style={styles.folderInfo}>
                            <View style={styles.folderPath}>
                                <Ionicons name="folder" size={20} color="#4CAF50" />
                                <View style={styles.folderTextContainer}>
                                    <Text style={styles.platformNameText} numberOfLines={1}>
                                        {t('baseFolder')}
                                    </Text>
                                    <Text style={styles.folderNameText} numberOfLines={2}>
                                        {(baseFolder)}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.folderActions}>
                                <TouchableOpacity
                                    style={[styles.button, styles.changeButton]}
                                    onPress={changeBaseFolder}
                                >
                                    <Text style={styles.buttonText}>{t('change')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={[styles.button, styles.selectButton]}
                            onPress={changeBaseFolder}
                        >
                            <Ionicons name="folder-outline" size={20} color="#fff" />
                            <Text style={styles.buttonText}>{t('selectBaseFolder')}</Text>
                        </TouchableOpacity>
                    )}
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

                {/* Download Settings Section */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('downloadSettings')}</Text>
                    <Text style={styles.sectionDescription}>
                        {t('downloadSettings')}
                    </Text>

                    <View style={styles.settingItem}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingTitle}>{t('unzipFiles')}</Text>
                            <Text style={styles.settingDescription}>
                                {t('unzipFilesDescription')}
                            </Text>
                        </View>
                        <Switch
                            value={unzipFilesOnDownload}
                            onValueChange={saveUnzipSetting}
                            trackColor={{ false: '#3e3e3e', true: '#4CAF50' }}
                            thumbColor={unzipFilesOnDownload ? '#fff' : '#f4f3f4'}
                            ios_backgroundColor="#3e3e3e"
                        />
                    </View>

                    <View style={styles.settingItem}>
                        <View style={styles.settingInfo}>
                            <Text style={styles.settingTitle}>{t('concurrentDownloads')}</Text>
                            <Text style={styles.settingDescription}>
                                {t('concurrentDownloadsDescription')}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.pickerButton}
                            onPress={() => setShowConcurrentDownloadsPicker(true)}
                        >
                            <Text style={styles.pickerButtonText}>{concurrentDownloads}</Text>
                            <Ionicons name="chevron-down" size={16} color="#ccc" />
                        </TouchableOpacity>
                    </View>
                </View>

                App Update Section
                {Platform.OS === 'android' && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('appUpdate')}</Text>
                        <Text style={styles.sectionDescription}>
                            {t('appUpdateDescription')}
                        </Text>

                        <View style={styles.settingItem}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingTitle}>{t('enableAppUpdates')}</Text>
                                <Text style={styles.settingDescription}>
                                    {t('enableAppUpdatesDescription')}
                                </Text>
                            </View>
                            <Switch
                                value={appUpdatesEnabled}
                                onValueChange={saveAppUpdatesEnabledSetting}
                                trackColor={{ false: '#3e3e3e', true: '#4CAF50' }}
                                thumbColor={appUpdatesEnabled ? '#fff' : '#f4f3f4'}
                                ios_backgroundColor="#3e3e3e"
                            />
                        </View>

                        <View style={styles.updateContainer}>
                            <View style={styles.versionInfo}>
                                <Text style={styles.versionText}>{t('currentVersion', { version })}</Text>
                                {updateAvailable && (
                                    <View style={styles.updateBadge}>
                                        <Ionicons name="arrow-up-circle" size={16} color="#4CAF50" />
                                        <Text style={styles.updateBadgeText}>{t('updateAvailable')}</Text>
                                    </View>
                                )}
                            </View>
                            <TouchableOpacity
                                style={[
                                    styles.button,
                                    styles.checkButton,
                                    !appUpdatesEnabled && styles.disabledButton,
                                    updateAvailable && styles.updateAvailableButton
                                ]}
                                onPress={updateAvailable ? () => handleDownloadUpdate(updateAvailable) : handleCheckForUpdates}
                                disabled={!appUpdatesEnabled || isCheckingForUpdate || isDownloading}
                            >
                                <Text style={[
                                    styles.buttonText,
                                    !appUpdatesEnabled && styles.disabledButtonText
                                ]}>
                                    {isCheckingForUpdate
                                        ? t('checkingForUpdate')
                                        : updateAvailable
                                            ? t('download')
                                            : t('checkForUpdates')
                                    }
                                </Text>
                            </TouchableOpacity>
                        </View>
                        {isDownloading && (
                            <View style={styles.downloadStatus}>
                                <Text style={styles.downloadingText}>{t('downloadingUpdate')}</Text>
                            </View>
                        )}
                    </View>
                )}

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

            {/* Concurrent Downloads Picker Modal */}
            <Modal
                visible={showConcurrentDownloadsPicker}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowConcurrentDownloadsPicker(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('concurrentDownloads')}</Text>
                            <TouchableOpacity
                                onPress={() => setShowConcurrentDownloadsPicker(false)}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.pickerOptions}>
                            {[1, 2, 3, 4, 5].map((number) => (
                                <TouchableOpacity
                                    key={number}
                                    style={[
                                        styles.pickerOption,
                                        concurrentDownloads === number && styles.pickerOptionSelected
                                    ]}
                                    onPress={() => {
                                        saveConcurrentDownloadsSetting(number);
                                        setShowConcurrentDownloadsPicker(false);
                                    }}
                                >
                                    <Text style={[
                                        styles.pickerOptionText,
                                        concurrentDownloads === number && styles.pickerOptionTextSelected
                                    ]}>
                                        {number} {number === 1 ? 'download' : 'downloads'}
                                    </Text>
                                    {concurrentDownloads === number && (
                                        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>
            </Modal>
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
    settingItem: {
        backgroundColor: '#111',
        borderRadius: 12,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    settingInfo: {
        flex: 1,
        marginRight: 16,
    },
    settingTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 4,
    },
    settingDescription: {
        color: '#ccc',
        fontSize: 14,
        lineHeight: 18,
    },
    pickerButton: {
        backgroundColor: '#2C2C2E',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minWidth: 60,
        gap: 8,
    },
    pickerButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: '#111',
        borderRadius: 20,
        margin: 20,
        maxWidth: 300,
        width: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    modalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    closeButton: {
        padding: 4,
    },
    pickerOptions: {
        padding: 20,
    },
    pickerOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginBottom: 8,
        backgroundColor: '#222',
    },
    pickerOptionSelected: {
        backgroundColor: '#1C4B3A',
        borderWidth: 1,
        borderColor: '#4CAF50',
    },
    pickerOptionText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '500',
    },
    pickerOptionTextSelected: {
        color: '#4CAF50',
        fontWeight: '600',
    },
    updateContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 12,
        padding: 16,
    },
    versionInfo: {
        flex: 1,
    },
    versionText: {
        color: '#ccc',
        fontSize: 14,
    },
    updateBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
        gap: 4,
    },
    updateBadgeText: {
        color: '#4CAF50',
        fontSize: 12,
        fontWeight: '600',
    },
    checkButton: {
        backgroundColor: '#007AFF',
    },
    updateAvailableButton: {
        backgroundColor: '#4CAF50',
    },
    disabledButton: {
        backgroundColor: '#555',
        opacity: 0.6,
    },
    disabledButtonText: {
        color: '#999',
    },
    downloadStatus: {
        marginTop: 16,
    },
    downloadingText: {
        color: '#ccc',
        fontSize: 14,
        marginBottom: 8,
    },
});
