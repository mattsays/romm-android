import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useToast } from '../contexts/ToastContext';
import { usePlatformFolders } from '../hooks/usePlatformFolders';
import { useStorageAccessFramework } from '../hooks/useStorageAccessFramework';
import { useTranslation } from '../hooks/useTranslation';

interface BaseFolderModalProps {
    visible: boolean;
    onComplete: () => void;
}

export const BaseFolderModal: React.FC<BaseFolderModalProps> = ({ visible, onComplete }) => {
    const { t } = useTranslation();
    const { requestDirectoryPermissions } = useStorageAccessFramework();
    const { setBaseFolder } = usePlatformFolders();
    const { showSuccessToast, showErrorToast } = useToast();
    const [isSelecting, setIsSelecting] = useState(false);

    const handleSelectBaseFolder = async () => {
        setIsSelecting(true);
        try {
            const folderUri = await requestDirectoryPermissions();

            if (folderUri) {
                await setBaseFolder(folderUri);
                showSuccessToast(t('baseFolderConfigured'));
                onComplete();
            }
        } catch (error: any) {
            console.error('Error selecting base folder:', error);

            if (error.type === 'permissions_denied') {
                Alert.alert(
                    t('permissionsNotGranted'),
                    t('permissionsNotGrantedMessage'),
                    [{ text: t('ok') }]
                );
            } else {
                showErrorToast(
                    error.message || t('errorSelectingFolder'),
                    t('error')
                );
            }
        } finally {
            setIsSelecting(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={styles.modalContainer}>
                    <View style={styles.iconContainer}>
                        <Ionicons name="folder-open-outline" size={64} color="#5f43b2" />
                    </View>

                    <Text style={styles.title}>{t('baseFolderRequired')}</Text>

                    <Text style={styles.message}>
                        {t('baseFolderRequiredMessage')}
                    </Text>

                    <TouchableOpacity
                        style={[styles.selectButton, isSelecting && styles.selectButtonDisabled]}
                        onPress={handleSelectBaseFolder}
                        disabled={isSelecting}
                    >
                        {isSelecting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <Ionicons name="folder-outline" size={20} color="#fff" />
                                <Text style={styles.selectButtonText}>
                                    {t('selectBaseFolder')}
                                </Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    modalContainer: {
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
    },
    iconContainer: {
        marginBottom: 20,
    },
    title: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 16,
    },
    message: {
        color: '#ccc',
        fontSize: 16,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 32,
    },
    selectButton: {
        backgroundColor: '#5f43b2',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        justifyContent: 'center',
    },
    selectButtonDisabled: {
        opacity: 0.7,
    },
    selectButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
