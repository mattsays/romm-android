import * as FileSystem from 'expo-file-system';
import ReactNativeBlobUtil from 'react-native-blob-util';
import { PlatformFolder } from '../hooks/usePlatformFolders';
import { apiClient, Rom } from './api';
import { notificationService } from './notificationService';

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
    tempFilePath?: string;
}

class DownloadService {
    private downloads: DownloadItem[] = [];
    private updateCallback?: (downloads: DownloadItem[]) => void;
    private maxConcurrentDownloads = 2;
    private downloadQueue: string[] = [];
    private activeDownloads: Set<string> = new Set();
    private speedCalculationInterval: number | null = null;

    initialize(updateCallback: (downloads: DownloadItem[]) => void): void {
        this.updateCallback = updateCallback;
        this.startSpeedCalculation();
        this.processQueue();

        // Initialize notification service
        notificationService.initialize();
    }

    cleanup(): void {
        if (this.speedCalculationInterval) {
            clearInterval(this.speedCalculationInterval);
        }
        // Cancel all active downloads
        this.downloads.forEach(download => {
            if (download.status === DownloadStatus.DOWNLOADING) {
                this.cancelDownload(download.id);
            }
        });
    }

    private generateDownloadId(): string {
        return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private updateDownload(downloadId: string, updates: Partial<DownloadItem>): void {
        const index = this.downloads.findIndex(d => d.id === downloadId);
        if (index !== -1) {
            this.downloads[index] = { ...this.downloads[index], ...updates };
            this.notifyUpdate();
        }
    }

    private notifyUpdate(): void {
        if (this.updateCallback) {
            this.updateCallback([...this.downloads]);
        }
    }

    private startSpeedCalculation(): void {
        this.speedCalculationInterval = setInterval(() => {
            this.downloads.forEach(download => {
                if (download.status === DownloadStatus.DOWNLOADING && download.startTime) {
                    const elapsed = (Date.now() - download.startTime.getTime()) / 1000;
                    const speed = elapsed > 0 ? download.downloadedBytes / elapsed : 0;
                    const remainingBytes = download.totalBytes - download.downloadedBytes;
                    const remainingTime = speed > 0 ? remainingBytes / speed : 0;

                    this.updateDownload(download.id, {
                        speed,
                        remainingTime,
                    });
                }
            });
        }, 1000);
    }

    addToQueue(rom: Rom, platformFolder: PlatformFolder): string {
        // Check if ROM is already in queue or downloading
        const existingDownload = this.downloads.find(d =>
            d.rom.id === rom.id &&
            (d.status === DownloadStatus.PENDING ||
                d.status === DownloadStatus.DOWNLOADING ||
                d.status === DownloadStatus.PAUSED)
        );

        if (existingDownload) {
            return existingDownload.id;
        }

        const downloadId = this.generateDownloadId();
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

        this.downloads.push(newDownload);
        this.downloadQueue.push(downloadId);
        this.notifyUpdate();
        this.processQueue();

        return downloadId;
    }

    private async processQueue(): Promise<void> {
        while (
            this.downloadQueue.length > 0 &&
            this.activeDownloads.size < this.maxConcurrentDownloads
        ) {
            const downloadId = this.downloadQueue.shift();
            if (downloadId) {
                await this.startDownload(downloadId);
            }
        }
    }

    private async startDownload(downloadId: string): Promise<void> {
        const download = this.downloads.find(d => d.id === downloadId);
        if (!download) return;

        this.activeDownloads.add(downloadId);

        try {
            this.updateDownload(downloadId, {
                status: DownloadStatus.DOWNLOADING,
                startTime: new Date(),
            });

            // Show notification that download started
            await notificationService.showDownloadStartedNotification(
                download.rom.name || download.rom.fs_name
            );

            // Get the download URL from the API
            const downloadUrl = await apiClient.obtainDownloadLink(download.rom);
            const fileName = download.rom.fs_name;
            const tempFilePath = FileSystem.cacheDirectory + fileName;

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

                    this.updateDownload(downloadId, {
                        progress,
                        downloadedBytes: downloadProgress.totalBytesWritten,
                        totalBytes: downloadProgress.totalBytesExpectedToWrite,
                    });
                }
            );

            this.updateDownload(downloadId, {
                downloadResumable,
                tempFilePath,
            });

            const result = await downloadResumable.downloadAsync();

            if (result && result.status === 200) {
                await this.completeDownload(downloadId, tempFilePath);
            } else {
                throw new Error(`Download failed with status ${result?.status || 'unknown'}`);
            }

        } catch (error) {
            console.error('Download error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            this.updateDownload(downloadId, {
                status: DownloadStatus.FAILED,
                error: errorMessage,
                endTime: new Date(),
            });

            // Show failure notification
            await notificationService.showDownloadFailedNotification(
                download.rom.name || download.rom.fs_name,
                errorMessage
            );
        } finally {
            this.activeDownloads.delete(downloadId);
            this.processQueue(); // Process next in queue
        }
    }

    private async completeDownload(downloadId: string, tempFilePath: string): Promise<void> {
        const download = this.downloads.find(d => d.id === downloadId);
        if (!download) return;

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

            this.updateDownload(downloadId, {
                status: DownloadStatus.COMPLETED,
                progress: 100,
                endTime: new Date(),
            });

            // Show completion notification
            await notificationService.showDownloadCompleteNotification(
                download.rom.name || download.rom.fs_name
            );

        } catch (error) {
            console.error('Error completing download:', error);
            const errorMessage = `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`;

            this.updateDownload(downloadId, {
                status: DownloadStatus.FAILED,
                error: errorMessage,
                endTime: new Date(),
            });

            // Show failure notification
            await notificationService.showDownloadFailedNotification(
                download.rom.name || download.rom.fs_name,
                errorMessage
            );
        }
    }

    removeFromQueue(downloadId: string): void {
        const index = this.downloads.findIndex(d => d.id === downloadId);
        if (index !== -1) {
            const download = this.downloads[index];

            // Cancel if actively downloading
            if (download.status === DownloadStatus.DOWNLOADING) {
                this.cancelDownload(downloadId);
            }

            // Remove from queue
            const queueIndex = this.downloadQueue.indexOf(downloadId);
            if (queueIndex !== -1) {
                this.downloadQueue.splice(queueIndex, 1);
            }

            // Remove from downloads
            this.downloads.splice(index, 1);
            this.notifyUpdate();
        }
    }

    retryDownload(downloadId: string): void {
        const download = this.downloads.find(d => d.id === downloadId);
        if (download && (download.status === DownloadStatus.FAILED || download.status === DownloadStatus.CANCELLED)) {
            this.updateDownload(downloadId, {
                status: DownloadStatus.PENDING,
                progress: 0,
                downloadedBytes: 0,
                error: undefined,
                startTime: undefined,
                endTime: undefined,
            });

            this.downloadQueue.push(downloadId);
            this.processQueue();
        }
    }

    pauseDownload(downloadId: string): void {
        const download = this.downloads.find(d => d.id === downloadId);
        if (download && download.status === DownloadStatus.DOWNLOADING) {
            if (download.downloadResumable) {
                download.downloadResumable.pauseAsync();
            }
            this.updateDownload(downloadId, {
                status: DownloadStatus.PAUSED,
            });
            this.activeDownloads.delete(downloadId);
            this.processQueue();
        }
    }

    resumeDownload(downloadId: string): void {
        const download = this.downloads.find(d => d.id === downloadId);
        if (download && download.status === DownloadStatus.PAUSED) {
            this.updateDownload(downloadId, {
                status: DownloadStatus.PENDING,
            });
            this.downloadQueue.unshift(downloadId); // Add to front of queue
            this.processQueue();
        }
    }

    cancelDownload(downloadId: string): void {
        const download = this.downloads.find(d => d.id === downloadId);
        if (download) {
            if (download.downloadResumable && download.status === DownloadStatus.DOWNLOADING) {
                download.downloadResumable.pauseAsync();
            }

            // Clean up temp file if exists
            if (download.tempFilePath) {
                FileSystem.deleteAsync(download.tempFilePath, { idempotent: true });
            }

            this.updateDownload(downloadId, {
                status: DownloadStatus.CANCELLED,
                endTime: new Date(),
            });

            this.activeDownloads.delete(downloadId);

            // Remove from queue if pending
            const queueIndex = this.downloadQueue.indexOf(downloadId);
            if (queueIndex !== -1) {
                this.downloadQueue.splice(queueIndex, 1);
            }

            this.processQueue();
        }
    }

    clearCompleted(): void {
        this.downloads = this.downloads.filter(d => d.status !== DownloadStatus.COMPLETED);
        this.notifyUpdate();
    }

    clearFailed(): void {
        this.downloads = this.downloads.filter(d =>
            d.status !== DownloadStatus.FAILED &&
            d.status !== DownloadStatus.CANCELLED
        );
        this.notifyUpdate();
    }

    getDownloads(): DownloadItem[] {
        return [...this.downloads];
    }

    getActiveDownloads(): DownloadItem[] {
        return this.downloads.filter(d =>
            d.status === DownloadStatus.DOWNLOADING ||
            d.status === DownloadStatus.PENDING
        );
    }
}

export const downloadService = new DownloadService();
