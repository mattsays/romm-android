import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useTranslation } from '../../hooks/useTranslation';
import { useToast } from '../../contexts/ToastContext';

export default function WebViewScreen() {
    const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const { showErrorToast } = useToast();

    const handleBack = () => {
        router.back();
    };

    if (!url) {
        return (
            <ProtectedRoute>
                <View style={[styles.container, { paddingTop: insets.top }]}>
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>{t('error')}</Text>
                    </View>
                    <View style={styles.errorContainer}>
                        <Text style={styles.errorText}>{t('errorOpeningFile')}</Text>
                    </View>
                </View>
            </ProtectedRoute>
        );
    }

    const decodedUrl = decodeURIComponent(url);

    return (
        <ProtectedRoute>
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {title ? decodeURIComponent(title) : 'Game'}
                    </Text>
                </View>
                <WebView
                    source={{ uri: decodedUrl }}
                    style={styles.webview}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    allowsInlineMediaPlayback={true}
                    mediaPlaybackRequiresUserAction={false}
                    allowsFullscreenVideo={true}
                    onLoadStart={() => console.log('WebView loading started:', decodedUrl)}
                    onLoadEnd={() => console.log('WebView loading ended')}
                    onError={(error) => {
                        console.error('WebView error:', error);
                        showErrorToast(t('errorOpeningFile'), t('error'));
                    }}
                    onHttpError={(syntheticEvent) => {
                        const { nativeEvent } = syntheticEvent;
                        console.error('WebView HTTP error:', nativeEvent);
                        showErrorToast(t('errorOpeningFile'), t('error'));
                    }}
                />
            </View>
        </ProtectedRoute>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        backgroundColor: '#000',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    backButton: {
        marginRight: 16,
        padding: 8,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        flex: 1,
    },
    webview: {
        flex: 1,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    errorText: {
        color: '#ef4444',
        fontSize: 16,
        textAlign: 'center',
    },
});
