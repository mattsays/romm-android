import React, { createContext, ReactNode, useContext } from 'react';
import Toast from 'react-native-toast-message';

interface ToastContextType {
    showSuccessToast: (message: string, title?: string) => void;
    showErrorToast: (message: string, title?: string) => void;
    showInfoToast: (message: string, title?: string) => void;
    showWarningToast: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

interface ToastProviderProps {
    children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
    const showSuccessToast = (message: string, title?: string) => {
        Toast.show({
            type: 'success',
            text1: title || 'Success',
            text2: message,
            visibilityTime: 3000,
            autoHide: true,
            topOffset: 60,
            bottomOffset: 40,
        });
    };

    const showErrorToast = (message: string, title?: string) => {
        Toast.show({
            type: 'error',
            text1: title || 'Error',
            text2: message,
            visibilityTime: 4000,
            autoHide: true,
            topOffset: 60,
            bottomOffset: 40,
        });
    };

    const showInfoToast = (message: string, title?: string) => {
        Toast.show({
            type: 'info',
            text1: title || 'Info',
            text2: message,
            visibilityTime: 3000,
            autoHide: true,
            topOffset: 60,
            bottomOffset: 40,
        });
    };

    const showWarningToast = (message: string, title?: string) => {
        Toast.show({
            type: 'warning',
            text1: title || 'Warning',
            text2: message,
            visibilityTime: 3500,
            autoHide: true,
            topOffset: 60,
            bottomOffset: 40,
        });
    };

    return (
        <ToastContext.Provider
            value={{
                showSuccessToast,
                showErrorToast,
                showInfoToast,
                showWarningToast,
            }}
        >
            {children}
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
