import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { PublicRoute } from '../../components/ProtectedRoute';
import { useToast } from '../../contexts/ToastContext';
import { useLogin } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { LoginCredentials, apiClient } from '../../services/api';

export default function LoginScreen() {
    const [credentials, setCredentials] = useState<LoginCredentials>({
        username: '',
        password: '',
    });
    const [serverUrl, setServerUrl] = useState<string>('http://romm:8080');
    const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'failed'>('checking');
    const { login, isLoading, error, clearError } = useLogin();
    const { t } = useTranslation();
    const { showErrorToast } = useToast();
    const router = useRouter();

    // Load saved server URL on component mount
    useEffect(() => {
        const loadSavedUrl = async () => {
            try {
                const savedUrl = await SecureStore.getItemAsync('server_url');
                if (savedUrl) {
                    setServerUrl(savedUrl);
                    apiClient.updateBaseUrl(savedUrl);
                } else {
                    setServerUrl(apiClient.baseUrl);
                }
            } catch (error) {
                console.error('Failed to load saved URL:', error);
                setServerUrl(apiClient.baseUrl);
            }
        };

        loadSavedUrl();
    }, []);

    // Test connection on component mount and when URL changes
    useEffect(() => {
        const testConnection = async () => {
            if (!serverUrl.trim()) return;

            setConnectionStatus('checking');
            try {
                const formattedUrl = formatUrl(serverUrl);
                apiClient.updateBaseUrl(formattedUrl);

                const isConnected = await apiClient.heartbeat();
                console.log("Trying to connect to server:", formattedUrl);
                setConnectionStatus(isConnected ? 'connected' : 'failed');
            } catch (error) {
                console.error('Connection test failed:', error);
                setConnectionStatus('failed');
            }
        };

        if (serverUrl) {
            testConnection();
        }
    }, [serverUrl]);

    const formatUrl = (url: string): string => {
        if (!url.trim()) return url;

        let formattedUrl = url.trim();

        // Add http:// if no protocol is specified
        if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
            formattedUrl = 'http://' + formattedUrl;
        }

        // Remove trailing slash
        formattedUrl = formattedUrl.replace(/\/$/, '');

        return formattedUrl;
    };

    const handleUrlChange = async (newUrl: string) => {
        setServerUrl(newUrl);
        if (newUrl.trim()) {
            try {
                const formattedUrl = formatUrl(newUrl);
                apiClient.updateBaseUrl(formattedUrl);
                await SecureStore.setItemAsync('server_url', formattedUrl);
            } catch (error) {
                console.error('Failed to save URL:', error);
            }
        }
    };

    const handleLogin = async () => {
        if (!credentials.username.trim() || !credentials.password.trim()) {
            showErrorToast(t('enterUsernameAndPassword'), t('error'));
            return;
        }

        try {
            clearError();

            // Ensure URL is properly formatted before login
            const formattedUrl = formatUrl(serverUrl);
            apiClient.updateBaseUrl(formattedUrl);

            await login(credentials);

            // Save the formatted server URL after successful login
            if (formattedUrl.trim()) {
                try {
                    await SecureStore.setItemAsync('server_url', formattedUrl);
                } catch (error) {
                    console.error('Failed to save URL after login:', error);
                }
            }

            router.replace('/');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t('errorDuringLogin');
            showErrorToast(errorMessage, t('loginError'));
        }
    };

    return (
        <PublicRoute>
            <KeyboardAvoidingView
                style={styles.container}
            >
                <ScrollView contentContainerStyle={styles.scrollContainer}>
                    <View style={styles.formContainer}>
                        <Text style={styles.title}>RomM</Text>
                        <Text style={styles.subtitle}>{t('loginToAccount')}</Text>

                        {/* Connection Status */}
                        <View style={styles.connectionStatus}>
                            {connectionStatus === 'checking' && (
                                <View style={styles.statusRow}>
                                    <ActivityIndicator size="small" color="#007AFF" />
                                    <Text style={styles.statusText}>{t('verifyingConnection')}</Text>
                                </View>
                            )}
                            {connectionStatus === 'connected' && (
                                <View style={styles.statusRow}>
                                    <Text style={styles.statusIcon}>✓</Text>
                                    <Text style={[styles.statusText, styles.successText]}>
                                        {t('connectedToServer')}
                                    </Text>
                                </View>
                            )}
                            {connectionStatus === 'failed' && (
                                <View style={styles.statusRow}>
                                    <Text style={styles.statusIcon}>⚠️</Text>
                                    <Text style={[styles.statusText, styles.errorText]}>
                                        {t('unableToConnectToServer')}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Server URL Configuration */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>{t('serverUrl')}</Text>
                            <TextInput
                                style={styles.input}
                                value={serverUrl}
                                onChangeText={handleUrlChange}
                                placeholder="192.168.1.100:8080"
                                placeholderTextColor="#666"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isLoading}
                                keyboardType="url"
                            />
                            <Text style={styles.urlHint}>
                                {t('serverUrlHint')} {'\n'}
                                Es: 192.168.1.100:8080 o http://romm.local:8080
                            </Text>
                        </View>

                        {error && (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorContainerText}>{error}</Text>
                            </View>
                        )}

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>{t('username')}</Text>
                            <TextInput
                                style={styles.input}
                                value={credentials.username}
                                onChangeText={(text) => setCredentials(prev => ({ ...prev, username: text }))}
                                placeholder={t('enterUsername')}
                                placeholderTextColor="#666"
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isLoading}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>{t('password')}</Text>
                            <TextInput
                                style={styles.input}
                                value={credentials.password}
                                onChangeText={(text) => setCredentials(prev => ({ ...prev, password: text }))}
                                placeholder={t('enterPassword')}
                                placeholderTextColor="#666"
                                secureTextEntry
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isLoading}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.loginButton, isLoading && styles.disabledButton]}
                            onPress={handleLogin}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.loginButtonText}>{t('login')}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </PublicRoute>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 20,
    },
    formContainer: {
        width: '100%',
        maxWidth: 400,
        alignSelf: 'center',
    },
    title: {
        fontSize: 48,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 18,
        color: '#ccc',
        textAlign: 'center',
        marginBottom: 20,
    },
    connectionStatus: {
        marginBottom: 20,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    statusText: {
        fontSize: 14,
        color: '#ccc',
    },
    successText: {
        color: '#059669',
    },
    errorContainer: {
        backgroundColor: '#dc2626',
        padding: 12,
        borderRadius: 8,
        marginBottom: 20,
    },
    errorContainerText: {
        color: '#fff',
        textAlign: 'center',
        fontSize: 14,
    },
    errorText: {
        color: '#dc2626',
        textAlign: 'center',
        fontSize: 14,
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        color: '#fff',
        marginBottom: 8,
        fontWeight: '500',
    },
    input: {
        backgroundColor: '#1a1a1a',
        borderColor: '#333',
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#fff',
    },
    loginButton: {
        backgroundColor: '#5f43b2',
        borderRadius: 8,
        padding: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    disabledButton: {
        backgroundColor: '#666',
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    forgotPasswordButton: {
        alignItems: 'center',
        padding: 8,
    },
    forgotPasswordText: {
        color: '#5f43b2',
        fontSize: 16,
    },
    urlToggleButton: {
        alignItems: 'center',
        padding: 12,
        marginBottom: 10,
    },
    urlToggleText: {
        color: '#5f43b2',
        fontSize: 16,
        fontWeight: '500',
    },
    urlHint: {
        color: '#888',
        fontSize: 12,
        marginTop: 5,
        fontStyle: 'italic',
    },
});
