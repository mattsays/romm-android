import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AuthProvider } from '../contexts/AuthContext';
import { DownloadProvider } from '../contexts/DownloadContext';
import { LanguageProvider } from '../contexts/LanguageContext';
import { ToastProvider } from '../contexts/ToastContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <ToastProvider>
          <AuthProvider>
            <DownloadProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  headerStyle: {
                    backgroundColor: '#000',
                  },
                  headerTintColor: '#fff',
                  headerTitleStyle: {
                    fontWeight: 'bold',
                  },
                  contentStyle: {
                    backgroundColor: '#000',
                  },
                }}
              />
              <Toast />
            </DownloadProvider>
          </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}