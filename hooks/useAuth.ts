import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, LoginCredentials, ResetPasswordData, ResetPasswordRequest } from '../services/api';

export const useLogin = () => {
    const { login, error, clearError } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async (credentials: LoginCredentials) => {
        try {
            setIsLoading(true);
            clearError();
            await login(credentials);
        } catch (error) {
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    return {
        login: handleLogin,
        isLoading,
        error,
        clearError,
    };
};

export const useLogout = () => {
    const { logout } = useAuth();
    const [isLoading, setIsLoading] = useState(false);

    const handleLogout = async () => {
        try {
            setIsLoading(true);
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
            // Don't throw error for logout as it should always succeed
        } finally {
            setIsLoading(false);
        }
    };

    return {
        logout: handleLogout,
        isLoading,
    };
};

export const useAuthCheck = () => {
    const { isAuthenticated, isLoading, user } = useAuth();

    return {
        isAuthenticated,
        isLoading,
        user,
        isAdmin: user?.role === 'admin',
        userId: user?.id,
        username: user?.username,
    };
};
