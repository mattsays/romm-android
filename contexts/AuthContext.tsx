import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { apiClient, LoginCredentials, User } from '../services/api';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (credentials: LoginCredentials) => Promise<void>;
    logout: () => Promise<void>;
    refreshUser: () => Promise<void>;
    clearError: () => void;
    error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const isAuthenticated = user !== null && apiClient.isAuthenticated();

    const refreshUser = async () => {
        try {
            if (apiClient.isAuthenticated()) {
                const userData = await apiClient.getCurrentUser();
                setUser(userData);
            } else {
                setUser(null);
            }
        } catch (error) {
            console.error('Failed to fetch user data:', error);
            setUser(null);
            // Don't throw error here as this might be called on app start
            // when user is not logged in
        }
    };

    const login = async (credentials: LoginCredentials) => {
        try {
            setIsLoading(true);
            setError(null);

            // Use session-based login with CSRF token
            await apiClient.login(credentials);

            // Fetch user data after successful login
            await refreshUser();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Login failed';
            setError(errorMessage);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        try {
            setIsLoading(true);
            await apiClient.logout();
            
        } catch (error) {
            console.error('Logout error:', error);
            // Continue with logout even if API call fails
        } finally {
            setUser(null);
            setIsLoading(false);
        }
    };

    const clearError = () => {
        setError(null);
    };

    // Initialize authentication state on app start
    useEffect(() => {
        const initializeAuth = async () => {
            try {
                setIsLoading(true);

                // Wait for the API client to load the token from storage
                await apiClient.waitForTokenLoad();

                // Check if we have a token and try to get user data
                if (apiClient.isAuthenticated()) {
                    await refreshUser();
                } else {
                    setUser(null);
                }
            } catch (error) {
                console.error('Auth initialization error:', error);
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        initializeAuth();
    }, []);

    const value: AuthContextType = {
        user,
        isLoading,
        isAuthenticated,
        login,
        logout,
        refreshUser,
        clearError,
        error,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
