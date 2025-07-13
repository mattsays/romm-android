import { getLocales } from 'expo-localization';
import { useEffect, useState } from 'react';

// Import delle traduzioni
import en from '../locales/en.json';
import it from '../locales/it.json';

type TranslationKeys = keyof typeof it;
type NestedTranslationKeys =
    | TranslationKeys
    | `platformNames.${keyof typeof it.platformNames}`;

const translations = {
    it,
    en,
};

export function useTranslation() {
    const [locale, setLocale] = useState<'it' | 'en'>('it');

    useEffect(() => {
        // Obtain the device's locale
        const deviceLocales = getLocales();
        const deviceLanguage = deviceLocales[0]?.languageCode;

        // Set the language based on the device, default Italian
        if (deviceLanguage === 'en') {
            setLocale('en');
        } else {
            setLocale('it');
        }
    }, []);

    const t = (key: NestedTranslationKeys): string => {
        const keys = key.split('.');
        let value: any = translations[locale];

        for (const k of keys) {
            value = value?.[k];
        }

        return value || key;
    };

    const changeLanguage = (newLocale: 'it' | 'en') => {
        setLocale(newLocale);
    };

    return { t, locale, changeLanguage };
}
