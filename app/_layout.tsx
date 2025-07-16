import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from '../contexts/AuthContext';
import { DownloadProvider } from '../contexts/DownloadContext';
import { LanguageProvider } from '../contexts/LanguageContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
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
          </DownloadProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}