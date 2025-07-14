import * as FileSystem from 'expo-file-system';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { PlatformFolder } from '../hooks/usePlatformFolders';
import { apiClient, Rom } from '../services/api';

// Define the types here to avoid import issues
export enum DownloadStatus {
    PENDING = 'pending',
    DOWNLOADING = 'downloading',
    PAUSED = 'paused',
    COMPLETED = 'completed',
    FAILED = 'failed',
    CANCELLED = 'cancelled',
}

export interface DownloadItem {
    id: string;
    rom: Rom;
    platformFolder: PlatformFolder;
    status: DownloadStatus;
    progress: number;
    downloadedBytes: number;
    totalBytes: number;
    speed: number; // bytes per second
    remainingTime: number; // seconds
    error?: string;
    startTime?: Date;
    endTime?: Date;
    downloadResumable?: FileSystem.DownloadResumable;
}

interface DownloadContextType {
    downloads: DownloadItem[];
    activeDownloads: DownloadItem[];
    completedDownloads: DownloadItem[];
    failedDownloads: DownloadItem[];
    isDownloading: (romId: number) => boolean;
    getDownloadById: (id: string) => DownloadItem | undefined;
    addToQueue: (rom: Rom, platformFolder: PlatformFolder) => string;
    removeFromQueue: (downloadId: string) => void;
    retryDownload: (downloadId: string) => void;
    clearCompleted: () => void;
    clearFailed: () => void;
    pauseDownload: (downloadId: string) => void;
    resumeDownload: (downloadId: string) => void;
    cancelDownload: (downloadId: string) => void;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export const useDownload = () => {
    const context = useContext(DownloadContext);
    if (context === undefined) {
        throw new Error('useDownload must be used within a DownloadProvider');
    }
    return context;
};

interface DownloadProviderProps {
    children: ReactNode;
}

export const DownloadProvider: React.FC<DownloadProviderProps> = ({ children }) => {
    const [downloads, setDownloads] = useState<DownloadItem[]>([]);
    const [downloadQueue, setDownloadQueue] = useState<string[]>([]);
    const [activeDownloads, setActiveDownloads] = useState<Set<string>>(new Set());
    const maxConcurrentDownloads = 2;

    // Process download queue
    useEffect(() => {
        const processQueue = async () => {
            if (downloadQueue.length > 0 && activeDownloads.size < maxConcurrentDownloads) {
                const downloadId = downloadQueue[0];
                const download = downloads.find(d => d.id === downloadId);

                if (download && download.status === DownloadStatus.PENDING) {
                    setDownloadQueue(prev => prev.slice(1));
                    setActiveDownloads(prev => new Set([...prev, downloadId]));
                    await startDownload(downloadId);
                }
            }
        };

        processQueue();
    }, [downloadQueue, activeDownloads.size, downloads]);

    const generateDownloadId = (): string => {
        return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    const updateDownload = (downloadId: string, updates: Partial<DownloadItem>): void => {
        setDownloads(prev =>
            prev.map(d => d.id === downloadId ? { ...d, ...updates } : d)
        );
    };

    const startDownload = async (downloadId: string): Promise<void> => {
        const download = downloads.find(d => d.id === downloadId);
        if (!download) return;

        try {
            updateDownload(downloadId, {
                status: DownloadStatus.DOWNLOADING,
                startTime: new Date(),
            });

            // Get the download URL from the API
            const downloadUrl = await apiClient.obtainDownloadLink(download.rom);
            const fileName = download.rom.fs_name;
            const tempFilePath = FileSystem.cacheDirectory + fileName;

            // Initialize speed tracking
            let lastProgressTime = Date.now();
            let lastDownloadedBytes = 0;
            let speedHistory: number[] = [];
            let currentSpeed = 0; // Keep track of current speed
            let currentRemainingTime = 0; // Keep track of current remaining time
            const maxSpeedHistoryLength = 5; // Keep last 5 speed measurements for smoothing
            const minTimeForSpeedCalculation = 1.0; // Minimum time in seconds for speed calculation

            // Create download resumable
            const downloadResumable = FileSystem.createDownloadResumable(
                downloadUrl,
                tempFilePath,
                {
                    headers: apiClient.getAuthHeaders(),
                },
                (downloadProgress) => {
                    const progress = Math.round(
                        (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
                    );

                    // Calculate speed only when enough time has passed
                    const currentTime = Date.now();
                    const timeElapsed = (currentTime - lastProgressTime) / 1000; // seconds
                    const bytesDownloaded = downloadProgress.totalBytesWritten - lastDownloadedBytes;

                    if (timeElapsed >= minTimeForSpeedCalculation && bytesDownloaded > 0) {
                        const instantSpeed = bytesDownloaded / timeElapsed; // bytes per second

                        // Add to speed history for smoothing
                        speedHistory.push(instantSpeed);
                        if (speedHistory.length > maxSpeedHistoryLength) {
                            speedHistory = speedHistory.slice(-maxSpeedHistoryLength);
                        }

                        // Calculate average speed for smoother display
                        currentSpeed = speedHistory.reduce((sum, s) => sum + s, instantSpeed) / speedHistory.length;

                        const remainingBytes = downloadProgress.totalBytesExpectedToWrite - downloadProgress.totalBytesWritten;
                        currentRemainingTime = currentSpeed > 0 ? remainingBytes / currentSpeed : 0;

                        // Update tracking variables for next calculation
                        lastProgressTime = currentTime;
                        lastDownloadedBytes = downloadProgress.totalBytesWritten;

                        updateDownload(downloadId, {
                            progress,
                            downloadedBytes: downloadProgress.totalBytesWritten,
                            totalBytes: downloadProgress.totalBytesExpectedToWrite,
                            speed: currentSpeed, // Use the last calculated speed
                            remainingTime: currentRemainingTime, // Use the last calculated remaining time
                        });
                    }


                }
            );

            updateDownload(downloadId, {
                downloadResumable,
            });

            await downloadResumable.downloadAsync().then(async (result) => {
                if (result) {
                    if (result.status === 200) {
                        await completeDownload(downloadId, tempFilePath, download);
                    } else {
                        throw new Error(`Download failed with status ${result?.status || 'unknown'}`);
                    }
                }
            });
        } catch (error) {
            console.error('Download error:', error);
            updateDownload(downloadId, {
                status: DownloadStatus.FAILED,
                error: error instanceof Error ? error.message : 'Unknown error',
                endTime: new Date(),
            });
        } finally {
            setActiveDownloads(prev => {
                const newSet = new Set(prev);
                newSet.delete(downloadId);
                return newSet;
            });
        }
    };

    const completeDownload = async (downloadId: string, tempFilePath: string, download: DownloadItem): Promise<void> => {
        try {
            // Create the file in the platform folder using Storage Access Framework
            const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
                download.platformFolder.folderUri,
                download.rom.fs_name,
                'application/octet-stream'
            );

            // Copy the file to the destination
            await ReactNativeBlobUtil.MediaCollection.writeToMediafile(
                fileUri,
                tempFilePath
            );

            // Delete the temporary file
            await FileSystem.deleteAsync(tempFilePath, { idempotent: true });

            updateDownload(downloadId, {
                status: DownloadStatus.COMPLETED,
                progress: 100,
                endTime: new Date(),
            });

        } catch (error) {
            console.error('Error completing download:', error);
            updateDownload(downloadId, {
                status: DownloadStatus.FAILED,
                error: `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`,
                endTime: new Date(),
            });
        }
    };

    const activeDownloadsList = downloads.filter(d =>
        d.status === DownloadStatus.DOWNLOADING ||
        d.status === DownloadStatus.PENDING
    );

    const completedDownloads = downloads.filter(d =>
        d.status === DownloadStatus.COMPLETED
    );

    const failedDownloads = downloads.filter(d =>
        d.status === DownloadStatus.FAILED ||
        d.status === DownloadStatus.CANCELLED
    );

    const isDownloading = (romId: number): boolean => {
        return downloads.some(d =>
            d.rom.id === romId &&
            (d.status === DownloadStatus.DOWNLOADING || d.status === DownloadStatus.PENDING)
        );
    };

    const getDownloadById = (id: string): DownloadItem | undefined => {
        return downloads.find(d => d.id === id);
    };

    const addToQueue = (rom: Rom, platformFolder: PlatformFolder): string => {
        // Check if ROM is already in queue or downloading
        const existingDownload = downloads.find(d =>
            d.rom.id === rom.id &&
            (d.status === DownloadStatus.PENDING ||
                d.status === DownloadStatus.DOWNLOADING ||
                d.status === DownloadStatus.PAUSED)
        );

        if (existingDownload) {
            return existingDownload.id;
        }

        const downloadId = generateDownloadId();
        const newDownload: DownloadItem = {
            id: downloadId,
            rom,
            platformFolder,
            status: DownloadStatus.PENDING,
            progress: 0,
            downloadedBytes: 0,
            totalBytes: rom.fs_size_bytes,
            speed: 0,
            remainingTime: 0,
        };

        setDownloads(prev => [...prev, newDownload]);
        setDownloadQueue(prev => [...prev, downloadId]);

        return downloadId;
    };

    const removeFromQueue = (downloadId: string): void => {
        const download = downloads.find(d => d.id === downloadId);
        if (download) {
            // Cancel if actively downloading
            if (download.status === DownloadStatus.DOWNLOADING) {
                cancelDownload(downloadId);
            }

            // Remove from queue
            setDownloadQueue(prev => prev.filter(id => id !== downloadId));

            // Remove from downloads
            setDownloads(prev => prev.filter(d => d.id !== downloadId));
        }
    };

    const retryDownload = (downloadId: string): void => {
        const download = downloads.find(d => d.id === downloadId);
        if (download && (download.status === DownloadStatus.FAILED || download.status === DownloadStatus.CANCELLED)) {
            updateDownload(downloadId, {
                status: DownloadStatus.PENDING,
                progress: 0,
                downloadedBytes: 0,
                error: undefined,
                startTime: undefined,
                endTime: undefined,
            });

            setDownloadQueue(prev => [downloadId, ...prev]); // Add to front of queue
        }
    };

    const clearCompleted = (): void => {
        setDownloads(prev => prev.filter(d => d.status !== DownloadStatus.COMPLETED));
    };

    const clearFailed = (): void => {
        setDownloads(prev => prev.filter(d =>
            d.status !== DownloadStatus.FAILED &&
            d.status !== DownloadStatus.CANCELLED
        ));
    };

    const pauseDownload = async (downloadId: string): Promise<void> => {
        const download = downloads.find(d => d.id === downloadId);
        if (download && download.status === DownloadStatus.DOWNLOADING) {
            if (download.downloadResumable) {
                await download.downloadResumable.pauseAsync();
            }

            updateDownload(downloadId, {
                status: DownloadStatus.PAUSED,
            });
        }
    };

    const resumeDownload = async (downloadId: string): Promise<void> => {
        const download = downloads.find(d => d.id === downloadId);
        if (download && download.status === DownloadStatus.PAUSED) {

            updateDownload(downloadId, {
                status: DownloadStatus.DOWNLOADING,
            });

            if (download.downloadResumable) {
                await download.downloadResumable.resumeAsync().then(async (result) => {
                    if (result) {
                        if (result.status === 200 || result.status === 206) {
                            await completeDownload(downloadId, FileSystem.cacheDirectory + download.rom.fs_name, download);
                        } else {
                            console.log(`Download failed with status ${result?.status || 'unknown'}`);
                        }
                    }
                });
            }
        }
    };

    const cancelDownload = (downloadId: string): void => {
        const download = downloads.find(d => d.id === downloadId);
        if (download) {

            if (download.downloadResumable && download.status === DownloadStatus.DOWNLOADING) {
                download.downloadResumable.pauseAsync();
            }

            // Clean up temp file if exists
            if (download.downloadResumable?.fileUri) {
                FileSystem.deleteAsync(FileSystem.cacheDirectory + download.rom.fs_name, { idempotent: true });
            }

            updateDownload(downloadId, {
                status: DownloadStatus.CANCELLED,
                endTime: new Date(),
            });

            setActiveDownloads(prev => {
                const newSet = new Set(prev);
                newSet.delete(downloadId);
                return newSet;
            });

            // Remove from queue if pending
            setDownloadQueue(prev => prev.filter(id => id !== downloadId));
        }
    };

    return (
        <DownloadContext.Provider
            value={{
                downloads,
                activeDownloads: activeDownloadsList,
                completedDownloads,
                failedDownloads,
                isDownloading,
                getDownloadById,
                addToQueue,
                removeFromQueue,
                retryDownload,
                clearCompleted,
                clearFailed,
                pauseDownload,
                resumeDownload,
                cancelDownload,
            }}
        >
            {children}
        </DownloadContext.Provider>
    );
};
