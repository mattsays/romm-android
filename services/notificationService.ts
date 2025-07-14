// Placeholder notification service - can be extended with expo-notifications when needed
export class NotificationService {
    private static instance: NotificationService;

    public static getInstance(): NotificationService {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }

    async initialize(): Promise<void> {
        // Placeholder - can implement expo-notifications here later
        console.log('NotificationService initialized');
    }

    async showDownloadCompleteNotification(romName: string): Promise<void> {
        console.log(`Download completed: ${romName}`);
        // Placeholder - implement with expo-notifications later
    }

    async showDownloadFailedNotification(romName: string, error: string): Promise<void> {
        console.log(`Download failed: ${romName} - ${error}`);
        // Placeholder - implement with expo-notifications later
    }

    async showDownloadStartedNotification(romName: string): Promise<void> {
        console.log(`Download started: ${romName}`);
        // Placeholder - implement with expo-notifications later
    }
}

export const notificationService = NotificationService.getInstance();
