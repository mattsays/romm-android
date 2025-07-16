import { Redirect } from 'expo-router';
import React, { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from '../hooks/useTranslation';

interface ProtectedRouteProps {
    children: ReactNode;
    fallback?: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = (props) => {
    const { children, fallback } = props;
    const { isAuthenticated, isLoading, user } = useAuth();
    const { t } = useTranslation();

    if (isLoading) {
        return fallback || (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>
                    {t('verifyingAuthentication')}
                </Text>
            </View>
        );
    }

    if (!isAuthenticated || !user) {
        return <Redirect href="/auth/login" />;
    }

    // Ensure children is valid before rendering
    if (!children) {
        return null;
    }

    return (
        <View style={{ flex: 1 }}>
            {children}
        </View>
    );
};

interface AdminRouteProps extends ProtectedRouteProps {
    adminFallback?: ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = (props) => {
    const { children, fallback, adminFallback } = props;
    const { isAuthenticated, isLoading, user } = useAuth();
    const { t } = useTranslation();

    if (isLoading) {
        return fallback || (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>
                    {t('verifyingPermissions')}
                </Text>
            </View>
        );
    }

    if (!isAuthenticated || !user) {
        return <Redirect href="/auth/login" />;
    }

    if (user.role !== 'admin') {
        return adminFallback || (
            <View style={styles.container}>
                <Text style={styles.errorText}>
                    {t('accessDenied')}
                </Text>
            </View>
        );
    }

    if (!children) {
        return null;
    }

    return (
        <View style={{ flex: 1 }}>
            {children}
        </View>
    );
};

import type { RedirectProps } from 'expo-router';

interface PublicRouteProps {
    children: ReactNode;
    redirectTo?: RedirectProps['href'];
}

export const PublicRoute: React.FC<PublicRouteProps> = (props) => {
    const { children, redirectTo = '/' } = props;
    const { isAuthenticated, isLoading } = useAuth();
    const { t } = useTranslation();

    if (isLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>
                    {t('loading')}
                </Text>
            </View>
        );
    }

    if (isAuthenticated) {
        return <Redirect href={redirectTo} />;
    }

    if (!children) {
        return null;
    }

    return (
        <View style={{ flex: 1 }}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
    },
    errorText: {
        fontSize: 16,
        textAlign: 'center',
        color: '#ef4444',
    },
});
