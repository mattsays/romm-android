import * as SecureStore from 'expo-secure-store';

const DEFAULT_API_URL = 'http://romm:8080';

// Authentication types
export interface LoginCredentials {
    username: string;
    password: string;
}

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    expires_in: number;
}

export interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    enabled: boolean;
    avatar_path?: string;
    last_login?: string;
    created_at: string;
    updated_at: string;
}


export interface MessageResponse {
    msg: string;
}

export interface ResetPasswordRequest {
    username: string;
}

export interface ResetPasswordData {
    new_password: string;
    token?: string;
}

// Types for the API responses
export interface Platform {
    id: number;
    slug: string;
    name: string;
    fs_slug: string;
    url_logo?: string;
    igdb_id?: number;
    sgdb_id?: number;
    logo_path?: string;
    rom_count: number;
}

export type CollectionType = 'collection' | 'franchise' | 'genre' | 'company' | 'mode';


export interface Collection {
    id: number;
    name: string;
    type: CollectionType;
    description?: string;
    path_covers_small: string[];
    path_covers_large: string[];
    rom_ids: number[];
    rom_count: number;
    created_at: string;
    updated_at: string;
    is_virtual: boolean;

}

export interface RomFile {
    id: number;
    file_name: string;
    file_name_no_tags: string;
    file_name_no_ext: string;
    file_extension: string;
    file_path: string;
    file_size_bytes: number;
    md5_hash?: string;
    crc_hash?: string;
    sha1_hash?: string;
}

export interface Rom {
    id: number;
    name?: string;
    slug?: string;
    summary?: string;
    platform_id: number;
    platform_name: string;
    platform_slug: string;
    fs_name: string;
    fs_size_bytes: number;
    files: RomFile[];
    url_cover?: string;
    igdb_id?: number;
    sgdb_id?: number;
    moby_id?: number;
    ss_id?: number;
    ra_id?: number;
}

export interface ApiResponse<T> {
    data: T;
    success: boolean;
    message?: string;
}

export interface ItemsResponse<T> {
    items: T[];
    total?: number;
    page?: number;
    per_page?: number;
}

class ApiClient {
    public baseUrl: string;
    private sessionToken: string | null = null;
    private tokenLoaded: boolean = false;

    constructor() {
        // Try load url from secure storage
        this.baseUrl = DEFAULT_API_URL; // Default URL
        SecureStore.getItemAsync('server_url')
            .then(url => {
                if (url) {
                    this.baseUrl = url.replace(/\/$/, ''); // Remove trailing slash if present
                } else {
                    this.baseUrl = DEFAULT_API_URL;
                }
                console.log('API base URL set to:', this.baseUrl);
                this.loadTokenFromStorage();
            });
    }

    // Method to update base URL
    updateBaseUrl(newUrl: string): void {
        // Remove trailing slash if present
        this.baseUrl = newUrl.replace(/\/$/, '');
    }

    private async loadTokenFromStorage(): Promise<void> {
        try {
            const sessionToken = await SecureStore.getItemAsync('session_token');

            if (sessionToken) {
                this.sessionToken = sessionToken;
            }
        } catch (error) {
            console.error('Failed to load token from storage:', error);
        } finally {
            this.tokenLoaded = true;
        }
    }

    async waitForTokenLoad(): Promise<void> {
        if (this.tokenLoaded) return;

        // Wait for token to be loaded
        while (!this.tokenLoaded) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }

    private async saveSessionTokenToStorage(sessionToken: string): Promise<void> {
        try {
            await SecureStore.setItemAsync('session_token', sessionToken);
            this.sessionToken = sessionToken;
        } catch (error) {
            console.error('Failed to save CSRF token to storage:', error);
        }
    }

    private async removeTokenFromStorage(): Promise<void> {
        try {
            console.debug('Removing token from storage');
            await SecureStore.deleteItemAsync('session_token');
            this.sessionToken = null;
        } catch (error) {
            console.error('Failed to remove token from storage:', error);
        }
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        console.log('Making API request to:', url, 'with options:', options);

        const defaultHeaders: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        // Add CSRF token as cookie if available
        if (this.sessionToken) {
            defaultHeaders['Cookie'] = `romm_session=${this.sessionToken}`;
        }

        // Merge with any provided headers
        const headers = {
            ...defaultHeaders,
            ...(options.headers as Record<string, string>),
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers,
            });

            if (!response.ok) {
                if (response.status % 400 < 100) {
                    // Token expired or invalid, remove it
                    await this.removeTokenFromStorage();
                    console.log("Response text:", await response.text());
                    throw new Error('Unauthorized - please login again');
                }
                console.log("Response text:", await response.text());
                throw new Error(`HTTP error! status: ${response.status}`);
            }



            // Extract CSRF token from response
            const sessionToken = this.extractSessionTokenFromResponse(response);
            if (sessionToken) {
                await this.saveSessionTokenToStorage(sessionToken);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    private extractSessionTokenFromResponse(response: Response): string | null {
        const setCookieHeader = response.headers.get('set-cookie');
        if (!setCookieHeader) return null;

        // Parse cookies from Set-Cookie header
        const cookies = setCookieHeader.split(',').map(cookie => cookie.trim());

        for (const cookie of cookies) {
            if (cookie.startsWith('romm_session=')) {
                const sessionMatch = cookie.match(/romm_session=([^;]+)/);
                return sessionMatch ? sessionMatch[1] : null;
            }
        }

        return null;
    }

    async getPlatforms(): Promise<Platform[]> {
        return this.request<Platform[]>('/api/platforms');
    }

    async getPlatform(platformId: number): Promise<Platform> {
        return this.request<Platform>(`/api/platforms/${platformId}`);
    }

    async getUserCollections(): Promise<Collection[]> {
        return this.request<Collection[]>('/api/collections');
    }

    async getVirtualCollections(type: CollectionType = 'collection'): Promise<Collection[]> {
        return this.request<Collection[]>(`/api/collections/virtual?type=${type}`);
    }

    async getAllVirtualCollections(): Promise<Record<CollectionType, Collection[]>> {
        const types: CollectionType[] = ['collection', 'franchise', 'genre', 'company', 'mode'];
        const collections: Record<CollectionType, Collection[]> = {} as Record<CollectionType, Collection[]>;

        for (const type of types) {
            collections[type] = await this.getVirtualCollections(type);
        }

        return collections;
    }


    async getCollection(collectionId: string, isVirtual: boolean): Promise<Collection> {

        if (isVirtual) {
            return this.request<Collection>(`/api/collections/virtual/${collectionId}`);
        }

        return this.request<Collection>(`/api/collections/${collectionId}`);
    }

    async getRomsByCollection(collectionId: string, isVirtual: boolean, limit: number = 10, offset: number = 0): Promise<ItemsResponse<Rom>> {
        if (isVirtual) {
            return this.request<ItemsResponse<Rom>>(`/api/roms?virtual_collection_id=${collectionId}&limit=${limit}&offset=${offset}`);
        }

        return this.request<ItemsResponse<Rom>>(`/api/roms?collection_id=${collectionId}&limit=${limit}&offset=${offset}`);
    }

    async getRomsRecentlyAdded(): Promise<Rom[]> {
        const response = await this.request<ItemsResponse<Rom>>('/api/roms?order_by=id&order_dir=desc&limit=15');
        return response.items;
    }

    async getRomsByPlatform(platformId: number, limit: number = 20, offset: number = 0): Promise<ItemsResponse<Rom>> {
        return this.request<ItemsResponse<Rom>>(`/api/roms?platform_id=${platformId}&limit=${limit}&offset=${offset}`);
    }

    async getRomById(romId: number): Promise<Rom> {
        return this.request<Rom>(`/api/roms/${romId}`);
    }

    async obtainDownloadLink(rom: Rom): Promise<string> {
        await this.waitForTokenLoad();

        const url = `${this.baseUrl}/api/roms/${rom.id}/content/${rom.fs_name}`;

        return url; // Return the download URL for use with FileSystem
    }

    getAuthHeaders(): Record<string, string> {
        const headers: Record<string, string> = {};
        if (this.sessionToken) {
            headers['Cookie'] = `romm_session=${this.sessionToken}`;
        }
        return headers;
    }

    async searchRoms(query: string): Promise<Rom[]> {
        const response = await this.request<ItemsResponse<Rom>>(`/api/roms?search_term=${encodeURIComponent(query)}`);
        return response.items;
    }

    // Authentication methods
    async heartbeat(): Promise<boolean> {
        // Ping the server to check if it's alive
        const response = await fetch(`${this.baseUrl}`);
        return response.ok;
    }

    async login(credentials: LoginCredentials): Promise<MessageResponse> {

        const url = `${this.baseUrl}/api/login`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    "Authorization": "Basic " + btoa(`${credentials.username}:${credentials.password}`),
                }
            });


            if (!response.ok) {
                console.log("Repsonse body:", await response.text());
                if (response.status === 401) {
                    throw new Error('Credenziali non valide');
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            // Extract CSRF token from response cookies
            console.log('Response headers:', response.headers.get("Set-Cookie"));
            const sessionToken = this.extractSessionTokenFromResponse(response);
            console.log('Session token from login response:', sessionToken);
            if (sessionToken) {
                await this.saveSessionTokenToStorage(sessionToken);
            }



            const data = await response.json();
            console.log('Login successful, response data:', data);
            return data;
        } catch (error) {
            console.error('Session login failed:', error);
            throw error;
        }
    }

    async logout(): Promise<MessageResponse> {
        // try {
        //     const response = await this.request<MessageResponse>('/api/logout', {
        //         method: 'POST',
        //     });

        //     // Always remove token from storage after logout
        //     await this.removeTokenFromStorage();

        //     return response;
        // } catch (error) {
        //     // Even if logout fails, remove local token
        //     await this.removeTokenFromStorage();
        //     throw error;
        // }
        await apiClient.removeTokenFromStorage();
        return { msg: 'Logged out successfully' };
    }

    async getCurrentUser(): Promise<User> {
        return this.request<User>('/api/users/me');
    }

    async forgotPassword(data: ResetPasswordRequest): Promise<MessageResponse> {
        return this.request<MessageResponse>('/api/forgot-password', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async resetPassword(data: ResetPasswordData): Promise<MessageResponse> {
        return this.request<MessageResponse>('/api/reset-password', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // Token management
    isAuthenticated(): boolean {
        return this.sessionToken !== null;
    }

    hassessionToken(): boolean {
        return this.sessionToken !== null;
    }

    async clearAuth(): Promise<void> {
        await this.removeTokenFromStorage();
    }
}

export const apiClient = new ApiClient();
