import { useEffect, useState } from 'react';
import { Dimensions } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

/**
 * Hook to calculate dynamic columns based on screen dimensions and orientation
 * Automatically adjusts the number of columns and card width based on:
 * - Device type (phone vs tablet)
 * - Screen orientation (portrait vs landscape)
 * - Available screen width
 */
export const useDynamicColumns = () => {
    const [screenData, setScreenData] = useState(Dimensions.get('window'));
    const [orientation, setOrientation] = useState<ScreenOrientation.Orientation>(
        ScreenOrientation.Orientation.PORTRAIT_UP
    );

    useEffect(() => {
        const subscription = Dimensions.addEventListener('change', ({ window }) => {
            setScreenData(window);
        });

        const getOrientation = async () => {
            const currentOrientation = await ScreenOrientation.getOrientationAsync();
            setOrientation(currentOrientation);
        };

        getOrientation();

        const orientationSubscription = ScreenOrientation.addOrientationChangeListener(
            (event) => {
                setOrientation(event.orientationInfo.orientation);
            }
        );

        return () => {
            subscription?.remove();
            ScreenOrientation.removeOrientationChangeListener(orientationSubscription);
        };
    }, []);

    const calculateColumns = () => {
        const { width, height } = screenData;
        const isLandscape = orientation === ScreenOrientation.Orientation.LANDSCAPE_LEFT || 
                           orientation === ScreenOrientation.Orientation.LANDSCAPE_RIGHT;
        
        // Base card width (minimum size for readability)
        const baseCardWidth = 120;
        // Padding and margins
        const horizontalPadding = 40; // 20px on each side
        const cardMargin = 10; // margin between cards
        
        // Calculate available width
        const availableWidth = width - horizontalPadding;
        
        // Calculate maximum possible columns based on card width
        const maxPossibleColumns = Math.floor(availableWidth / (baseCardWidth + cardMargin));
        
        // Set column limits based on device type and orientation
        let minColumns = 2;
        let maxColumns = 6;
        
        // Adjust based on screen size (tablet vs phone)
        if (width >= 768) { // Tablet
            minColumns = isLandscape ? 4 : 3;
            maxColumns = isLandscape ? 8 : 6;
        } else { // Phone
            minColumns = isLandscape ? 3 : 2;
            maxColumns = isLandscape ? 6 : 4;
        }
        
        // Final column count within limits
        const columns = Math.max(minColumns, Math.min(maxColumns, maxPossibleColumns));
        
        // Calculate actual card width based on final column count
        const actualCardWidth = Math.floor((availableWidth - (cardMargin * (columns - 1))) / columns);
        
        return { columns, cardWidth: actualCardWidth, isLandscape };
    };

    return calculateColumns();
};
