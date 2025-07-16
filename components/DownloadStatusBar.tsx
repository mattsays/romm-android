import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DownloadStatus, useDownload } from '../contexts/DownloadContext';
import { useTranslation } from '../hooks/useTranslation';

interface DownloadStatusBarProps {
    onPress?: () => void;
}

export const DownloadStatusBar: React.FC<DownloadStatusBarProps> = ({ onPress }) => {
    const { activeDownloads } = useDownload();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();

    if (activeDownloads.length === 0) {
        return null;
    }

    const currentDownload = activeDownloads.find(d => d.status === DownloadStatus.DOWNLOADING);
    const pendingCount = activeDownloads.filter(d => d.status === DownloadStatus.PENDING).length;

    const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const formatSpeed = (bytesPerSecond: number): string => {
        if (!bytesPerSecond || bytesPerSecond < 1 || !isFinite(bytesPerSecond)) {
            return '0 B/s';
        }
        return formatBytes(bytesPerSecond) + '/s';
    };

    return (
        <TouchableOpacity
            style={[styles.container, { paddingBottom: insets.bottom }]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <View style={styles.content}>
                <View style={styles.leftSection}>
                    <Ionicons name="download" size={16} color="#007AFF" />
                    <View style={styles.textContainer}>
                        {currentDownload ? (
                            <>
                                <Text style={styles.primaryText} numberOfLines={1}>
                                    {currentDownload.rom.name || currentDownload.rom.fs_name}
                                </Text>
                                <Text style={styles.secondaryText}>
                                    {currentDownload.progress}% • {formatSpeed(currentDownload.speed)}
                                    {pendingCount > 0 && ` • ${t('pendingInQueue', { count: pendingCount.toString() })}`}
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.primaryText}>
                                    {t('downloadsInQueue', { count: pendingCount.toString() })}
                                </Text>
                                <Text style={styles.secondaryText}>
                                    {t('waitingToStart')}
                                </Text>
                            </>
                        )}
                    </View>
                </View>

                <View style={styles.rightSection}>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{activeDownloads.length}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#8E8E93" />
                </View>
            </View>

            {currentDownload && (
                <View style={styles.progressBar}>
                    <View
                        style={[
                            styles.progressFill,
                            { width: `${currentDownload.progress}%` }
                        ]}
                    />
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#1C1C1E',
        borderTopWidth: 1,
        borderTopColor: '#333',
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    leftSection: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 12,
    },
    textContainer: {
        marginLeft: 8,
        flex: 1,
    },
    primaryText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 2,
    },
    secondaryText: {
        color: '#8E8E93',
        fontSize: 12,
    },
    rightSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    badge: {
        backgroundColor: '#007AFF',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    badgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
    },
    progressBar: {
        height: 2,
        backgroundColor: '#333',
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        backgroundColor: '#007AFF',
    },
});
