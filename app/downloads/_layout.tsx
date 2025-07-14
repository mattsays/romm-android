import { Stack } from 'expo-router';

export default function DownloadsLayout() {
    return (
        <Stack>
            <Stack.Screen
                name="index"
                options={{
                    headerShown: false,
                    title: 'Download',
                    presentation: 'card',
                    animation: 'slide_from_bottom',
                }}
            />
        </Stack>
    );
}
