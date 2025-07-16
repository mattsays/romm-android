import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import React, { createContext, useContext, useEffect, useState } from 'react';

// Import translations
import de from '../locales/de.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import it from '../locales/it.json';
import ja from '../locales/ja.json';
import nl from '../locales/nl.json';
import pt from '../locales/pt.json';
import ru from '../locales/ru.json';

type TranslationKeys = keyof typeof en;
type NestedTranslationKeys = TranslationKeys;

// Supported locales type
export type SupportedLocale = 'en' | 'it' | 'fr' | 'es' | 'de' | 'pt' | 'ja' | 'ru' | 'nl';

const translations = {
    en,
    it,
    fr,
    es,
    de,
    pt,
    ja,
    ru,
    nl,
};

// Mapping of language codes to supported locales
const languageMap: Record<string, SupportedLocale> = {
    'en': 'en',
    'it': 'it',
    'fr': 'fr',
    'es': 'es',
    'de': 'de',
    'pt': 'pt',
    'ja': 'ja',
    'ru': 'ru',
    'nl': 'nl',
    // Additional mappings for regional variants
    'en-US': 'en',
    'en-GB': 'en',
    'it-IT': 'it',
    'fr-FR': 'fr',
    'es-ES': 'es',
    'es-MX': 'es',
    'de-DE': 'de',
    'pt-BR': 'pt',
    'pt-PT': 'pt',
    'ja-JP': 'ja',
    'ru-RU': 'ru',
    'nl-NL': 'nl',
};

const LANGUAGE_STORAGE_KEY = '@language_preference';

interface LanguageContextType {
    locale: SupportedLocale;
    t: (key: NestedTranslationKeys, params?: Record<string, string>) => string;
    changeLanguage: (newLocale: SupportedLocale) => Promise<void>;
    supportedLocales: SupportedLocale[];
    isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
    const [locale, setLocale] = useState<SupportedLocale>('en');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        initializeLanguage();
    }, []);

    const initializeLanguage = async () => {
        try {
            // First, try to get saved language preference
            const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);

            if (savedLanguage && translations[savedLanguage as SupportedLocale]) {
                setLocale(savedLanguage as SupportedLocale);
            } else {
                // If no saved preference, use device language
                const deviceLocales = getLocales();
                const deviceLanguage = deviceLocales[0]?.languageCode;
                const deviceLocaleString = deviceLocales[0]?.languageTag;

                // Try to match exact locale first (e.g., en-US), then fallback to language code (e.g., en)
                const mappedLocale = languageMap[deviceLocaleString || ''] || languageMap[deviceLanguage || ''];

                if (mappedLocale) {
                    setLocale(mappedLocale);
                    // Save the detected language as preference
                    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, mappedLocale);
                } else {
                    // Default to English if no match found
                    setLocale('en');
                    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
                }
            }
        } catch (error) {
            console.error('Error initializing language:', error);
            setLocale('en');
        } finally {
            setIsLoading(false);
        }
    };

    const changeLanguage = async (newLocale: SupportedLocale) => {
        try {
            setLocale(newLocale);
            await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLocale);
        } catch (error) {
            console.error('Error saving language preference:', error);
        }
    };

    const t = (key: NestedTranslationKeys, params?: Record<string, string>): string => {
        const keys = key.split('.');
        let value: any = translations[locale];

        for (const k of keys) {
            value = value?.[k];
        }

        if (!value) return key;

        // Handle interpolation
        if (params) {
            return Object.keys(params).reduce((str, param) => {
                return str.replace(new RegExp(`{{${param}}}`, 'g'), params[param]);
            }, value);
        }

        return value;
    };

    const contextValue: LanguageContextType = {
        locale,
        t,
        changeLanguage,
        supportedLocales: Object.keys(translations) as SupportedLocale[],
        isLoading,
    };

    return (
        <LanguageContext.Provider value={contextValue}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage(): LanguageContextType {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}

// Backward compatibility hook
export function useTranslation() {
    return useLanguage();
}
