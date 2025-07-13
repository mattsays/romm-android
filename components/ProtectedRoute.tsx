import { Redirect } from 'expo-router';
import React, { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: ReactNode;
    fallback?: ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    fallback
}) => {
    const { isAuthenticated, isLoading, user } = useAuth();

    if (isLoading) {
        return fallback || (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>
                    Verificando autenticazione...
                </Text>
            </View>
        );
    }

    if (!isAuthenticated || !user) {
        return <Redirect href="/auth/login" />;
    }

    return <>{children}</>;
};

interface AdminRouteProps extends ProtectedRouteProps {
    adminFallback?: ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({
    children,
    fallback,
    adminFallback
}) => {
    const { isAuthenticated, isLoading, user } = useAuth();

    if (isLoading) {
        return fallback || (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>
                    Verificando autorizzazioni...
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
                    Accesso negato. Sono richiesti i privilegi di amministratore.
                </Text>
            </View>
        );
    }

    return <>{children}</>;
};

import type { RedirectProps } from 'expo-router';

interface PublicRouteProps {
    children: ReactNode;
    redirectTo?: RedirectProps['href'];
}

export const PublicRoute: React.FC<PublicRouteProps> = ({
    children,
    redirectTo = '/'
}) => {
    const { isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>
                    Caricamento...
                </Text>
            </View>
        );
    }

    if (isAuthenticated) {
        return <Redirect href={redirectTo} />;
    }

    return <>{children}</>;
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
