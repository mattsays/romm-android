import { Ionicons } from '@expo/vector-icons';
import * as SAF from '@joplin/react-native-saf-x';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useDownload } from '../../contexts/DownloadContext';
import { useToast } from '../../contexts/ToastContext';
import { usePlatformFolders } from '../../hooks/usePlatformFolders';
import { useRomDownload } from '../../hooks/useRomDownload';
import { useRomFileSystem } from '../../hooks/useRomFileSystem';
import { useTranslation } from '../../hooks/useTranslation';
import { apiClient, Platform, Rom } from '../../services/api';

export default function GameDetailsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();
    const { t } = useTranslation();
    const { showSuccessToast, showErrorToast, showInfoToast } = useToast();
    const [rom, setRom] = useState<Rom | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [existingFilePath, setExistingFilePath] = useState<string | null>(null);
    const { downloadRom, isRomDownloading } = useRomDownload();
    const { getDownloadById, completedDownloads, activeDownloads } = useDownload();
    const { searchPlatformFolder } = usePlatformFolders();
    const { isRomDownloaded, isCheckingRom, refreshRomCheck, resetRomsCheck } = useRomFileSystem();

    // Ref per tenere traccia dei download completati già processati
    const processedDownloadsRef = useRef<Set<string>>(new Set());

    // Get the current download item for the ROM to access progress
    const getCurrentDownload = () => {
        if (!rom) return null;
        return activeDownloads.find(download => download.rom.id === rom.id) || null;
    };

    const currentDownload = getCurrentDownload();
    const downloadProgress = (currentDownload?.progress || 0) / 100; // Progress is 0-100, convert to 0-1 for width percentage

    useEffect(() => {
        if (id) {
            // Reset dei download processati quando cambia la ROM
            processedDownloadsRef.current.clear();
            loadRomDetails();
        }
    }, [id]);

    // Listen for completed downloads to refresh ROM check
    useEffect(() => {
        if (rom && completedDownloads.length > 0) {
            // Controlla solo i nuovi download completati che non sono stati processati
            const newCompletedDownloads = completedDownloads.filter(
                download => download.rom.id === rom.id && !processedDownloadsRef.current.has(download.id)
            );

            if (newCompletedDownloads.length > 0) {
                // Marca tutti i nuovi download come processati
                newCompletedDownloads.forEach(download => {
                    processedDownloadsRef.current.add(download.id);
                });

                // Aggiorna lo stato per questa ROM
                const refreshAndUpdate = async () => {
                    await refreshRomCheck(rom);
                    await updateExistingFilePath(rom);
                };
                refreshAndUpdate();
            }
        }
    }, [completedDownloads, rom?.id]);

    // Force check ROM status when ROM changes
    useEffect(() => {
        if (rom) {
            const checkRomStatus = async () => {
                await updateExistingFilePath(rom);
                await refreshRomCheck(rom);
            };
            checkRomStatus();
        }
    }, [rom?.id]);

    const loadRomDetails = async () => {
        try {
            setLoading(true);
            setError(null);
            const romData = await apiClient.getRomById(parseInt(id));
            setRom(romData);
            // Update existing file path when ROM is loaded
            await updateExistingFilePath(romData);
        } catch (error) {
            console.error('Error loading ROM details:', error);
            setError(t('errorLoadingGameDetails'));
        } finally {
            setLoading(false);
        }
    };

    const updateExistingFilePath = async (rom: Rom) => {
        try {
            console.log('Updating existing file path for ROM:', rom.fs_name);
            const platformSlug = rom.platform_slug;
            const platformFolder = await searchPlatformFolder({ name: rom.platform_name, slug: rom.platform_slug } as Platform);

            if (!platformFolder) {
                console.log('No platform folder found for:', platformSlug);
                setExistingFilePath(null);
                return;
            }

            console.log('Platform folder found:', platformFolder.folderUri);
            
            // Check if the ROM file exists in the platform folder
            const romExists = await SAF.exists(
                platformFolder.folderUri + '/' + rom.fs_name
            );

            if(romExists) {
                setExistingFilePath(platformFolder.folderUri + '/' + rom.fs_name);
                return;
            }

            console.log('No matching file found for ROM:', rom.fs_name);
            // If no file found, clear the path
            setExistingFilePath(null);
        } catch (error) {
            console.error('Error updating existing file path:', error);
            setExistingFilePath(null);
        }
    };

    const handleBack = () => {
        router.back();
    };

    const handleDownload = async () => {
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

    const handleDeleteFile = async (rom: Rom) => {
        if (!existingFilePath) {
            showErrorToast(t('noFileToDelete'), t('error'));
            return;
        }

        Alert.alert(
            t('confirmDeletion'),
            t('confirmDeleteFile', { fileName: rom.name || rom.fs_name }),
            [
                {
                    text: t('cancel'),
                    style: 'cancel',
                },
                {
                    text: t('delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // Try to delete the file using Storage Access Framework
                            const platformFolder = await searchPlatformFolder({ name: rom.platform_name, slug: rom.platform_slug } as Platform);

                            if (!platformFolder) {
                                throw new Error(t('platformFolderNotFound'));
                            }

                            const romExists = await SAF.exists(
                                platformFolder.folderUri + '/' + rom.fs_name
                            );

                            if (romExists) {
                                await SAF.unlink(
                                    platformFolder.folderUri + '/' + rom.fs_name
                                );

                                // Update the state to reflect that the file is no longer downloaded
                                setExistingFilePath(null);
                                // Refresh the ROM check in the global state
                                resetRomsCheck([rom])

                                showSuccessToast(
                                    t('fileDeletedSuccessfully'),
                                    t('fileDeleted')
                                );
                            }                            
                        } catch (error) {
                            console.error('Error deleting file:', error);
                            const errorMessage = error instanceof Error ? error.message : t('errorDeletingFile');
                            showErrorToast(
                                t('cannotDeleteFile', { error: errorMessage }),
                                t('error')
                            );
                        }
                    },
                },
            ]
        );
    };



    if (loading) {
        return (
            <ProtectedRoute>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={styles.loadingText}>{t('loading')}</Text>
                </View>
            </ProtectedRoute>
        );
    }

    if (error || !rom) {
        return (
            <ProtectedRoute>
                <View style={styles.centered}>
                    <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
                    <Text style={styles.errorText}>
                        {error || t('gameNotFound')}
                    </Text>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <Text style={styles.backButtonText}>{t('goBack')}</Text>
                    </TouchableOpacity>
                </View>
            </ProtectedRoute>
        );
    }

    return (
        <ProtectedRoute>
            <ScrollView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.title}>{t('gameDetails')}</Text>
                </View>

                <View style={styles.content}>
                    {rom.url_cover && (
                        <Image
                            source={{ uri: rom.url_cover }}
                            style={styles.coverImage}
                            resizeMode="contain"
                        />
                    )}

                    <View style={styles.gameInfo}>
                        <Text style={styles.gameName}>{rom.name || rom.fs_name}</Text>
                        <Text style={styles.platformName}>{rom.platform_name}</Text>

                        {rom.summary && (
                            <View style={styles.section}>
                                <Text style={styles.sectionTitle}>{t('description')}</Text>
                                <Text style={styles.summary}>{rom.summary}</Text>
                            </View>
                        )}

                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{t('information')}</Text>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>{t('size')}:</Text>
                                <Text style={styles.infoValue}>
                                    {(rom.fs_size_bytes / (1024 * 1024)).toFixed(2)} MB
                                </Text>
                            </View>
                            <View style={styles.infoRow}>
                                <Text style={styles.infoLabel}>{t('platform')}:</Text>
                                <Text style={styles.infoValue}>{rom.platform_name}</Text>
                            </View>
                        </View>

                        {/* Download Section */}
                        <View style={styles.section}>
                            {(() => {
                                const isDownloaded = rom && isRomDownloaded(rom.id);
                                const isChecking = rom && isCheckingRom(rom.id);
                                const isCurrentlyDownloading = rom && isRomDownloading(rom.id);

                                if (isChecking) {
                                    return (
                                        <View style={styles.checkingContainer}>
                                            <ActivityIndicator size="small" color="#007AFF" />
                                            <Text style={styles.checkingText}>{t('checkingExistingFiles')}</Text>
                                        </View>
                                    );
                                } else if (isDownloaded) {
                                    return (
                                        <View style={styles.alreadyDownloadedContainer}>
                                            <View style={styles.alreadyDownloadedHeader}>
                                                <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                                                <Text style={styles.alreadyDownloadedTitle}>{t('fileAlreadyDownloaded')}</Text>
                                            </View>
                                            {existingFilePath && (
                                                <Text style={styles.alreadyDownloadedPath}>
                                                    {t('filePath')}: {existingFilePath}
                                                </Text>
                                            )}
                                            <View style={styles.alreadyDownloadedActions}>
                                                <TouchableOpacity
                                                    style={[styles.downloadButton, styles.redownloadButton]}
                                                    onPress={handleDownload}
                                                    disabled={isCurrentlyDownloading}
                                                >
                                                    <Ionicons name="download-outline" size={20} color="#fff" />
                                                    <Text style={styles.downloadButtonText}>{t('redownload')}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.downloadButton, styles.verifyButton]}
                                                    onPress={() => rom && refreshRomCheck(rom).then(() => updateExistingFilePath(rom))}
                                                >
                                                    <Ionicons name="refresh-outline" size={20} color="#fff" />
                                                    <Text style={styles.downloadButtonText}>{t('verify')}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.downloadButton, styles.deleteButton]}
                                                    onPress={() => handleDeleteFile(rom)}
                                                >
                                                    <Ionicons name="trash-outline" size={20} color="#fff" />
                                                    <Text style={styles.downloadButtonText}>{t('delete')}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    );
                                } else {
                                    return (
                                        <TouchableOpacity
                                            style={[
                                                styles.downloadButton,
                                                isCurrentlyDownloading && styles.downloadingButton
                                            ]}
                                            onPress={handleDownload}
                                            disabled={isCurrentlyDownloading}
                                        >
                                            {/* Progress bar background when downloading */}
                                            {isCurrentlyDownloading && (
                                                <View style={[styles.progressBackground, StyleSheet.absoluteFill]}>
                                                    <View
                                                        style={[
                                                            styles.progressFill,
                                                            { width: `${downloadProgress * 100}%` }
                                                        ]}
                                                    />
                                                </View>
                                            )}

                                            {isCurrentlyDownloading ? (
                                                <View style={styles.downloadingContent}>
                                                    <ActivityIndicator size="small" color="#fff" />
                                                    <Text style={styles.downloadButtonText}>
                                                        {currentDownload ?
                                                            `${t('downloading')} ${Math.round(downloadProgress * 100)}%` :
                                                            t('addedToQueue')
                                                        }
                                                    </Text>
                                                </View>
                                            ) : (
                                                <View style={styles.downloadContent}>
                                                    <Ionicons name="download-outline" size={20} color="#fff" />
                                                    <Text style={styles.downloadButtonText}>{t('downloadRom')}</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                }
                            })()}
                        </View>
                    </View>
                </View>
            </ScrollView>
        </ProtectedRoute>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#000',
        padding: 20,
    },
    loadingText: {
        color: '#fff',
        fontSize: 16,
        marginTop: 10,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 16,
        textAlign: 'center',
        marginTop: 16,
        marginBottom: 20,
    },
    backButton: {
        backgroundColor: '#007AFF',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 8,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    backBtn: {
        marginRight: 16,
        padding: 8,
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: 'bold',
    },
    content: {
        padding: 20,
    },
    coverImage: {
        width: '100%',
        height: 300,
        borderRadius: 12,
        marginBottom: 20,
    },
    gameInfo: {
        flex: 1,
    },
    gameName: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    platformName: {
        color: '#ccc',
        fontSize: 16,
        marginBottom: 20,
    },
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    summary: {
        color: '#ccc',
        fontSize: 14,
        lineHeight: 20,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    infoLabel: {
        color: '#ccc',
        fontSize: 14,
    },
    infoValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    downloadButton: {
        backgroundColor: '#5f43b2',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        overflow: 'hidden', // Ensure progress bar stays within button bounds
        position: 'relative', // Allow for absolute positioning of progress bar
    },
    downloadingButton: {
        backgroundColor: '#666',
    },
    downloadContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    downloadingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        zIndex: 1, // Ensure content stays above progress bar
    },
    downloadButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    progressContainer: {
        marginTop: 12,
    },
    progressBar: {
        height: 4,
        backgroundColor: '#333',
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: 'rgba(95, 67, 178, 0.8)', // Semi-transparent version of button color
        borderRadius: 12,
    },
    progressBackground: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        overflow: 'hidden',
    },
    checkingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#111',
        borderRadius: 12,
        gap: 8,
    },
    checkingText: {
        color: '#007AFF',
        fontSize: 14,
        fontWeight: '500',
    },
    alreadyDownloadedContainer: {
        backgroundColor: '#1a2e1a',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#34C759',
    },
    alreadyDownloadedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        gap: 8,
    },
    alreadyDownloadedTitle: {
        color: '#34C759',
        fontSize: 16,
        fontWeight: 'bold',
    },
    alreadyDownloadedPath: {
        color: '#ccc',
        fontSize: 12,
        marginBottom: 12,
        lineHeight: 16,
    },
    alreadyDownloadedActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    redownloadButton: {
        backgroundColor: '#FF9500',
        minWidth: '30%',
        flex: 1,
    },
    verifyButton: {
        backgroundColor: '#007AFF',
        minWidth: '30%',
        flex: 1,
    },
    deleteButton: {
        backgroundColor: '#FF3B30',
        minWidth: '30%',
        flex: 1,
    },
});