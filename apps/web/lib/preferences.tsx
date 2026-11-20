'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  DEFAULT_FONT,
  DEFAULT_LOCALE,
  FONT_COOKIE,
  LOCALE_COOKIE,
  isFontChoice,
  isLocale,
  translate,
  type FontChoice,
  type Locale,
  type TranslationKey,
} from './i18n';

interface PreferencesContextValue {
  locale: Locale;
  font: FontChoice;
  setLocale: (locale: Locale) => void;
  setFont: (font: FontChoice) => void;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function writePreference(name: string, value: string) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${name}=${value}; path=/; max-age=31536000; SameSite=Lax${secure}`;
}

export function resolveLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function resolveFont(value: string | undefined): FontChoice {
  return isFontChoice(value) ? value : DEFAULT_FONT;
}

export function AppPreferencesProvider({
  initialLocale,
  initialFont,
  children,
}: {
  initialLocale: Locale;
  initialFont: FontChoice;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState(initialLocale);
  const [font, setFontState] = useState(initialFont);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.font = font;
  }, [font]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writePreference(LOCALE_COOKIE, next);
    document.documentElement.lang = next;
  }, []);

  const setFont = useCallback((next: FontChoice) => {
    setFontState(next);
    writePreference(FONT_COOKIE, next);
    document.documentElement.dataset.font = next;
  }, []);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      locale,
      font,
      setLocale,
      setFont,
      t: (key, vars) => translate(locale, key, vars),
    }),
    [font, locale, setFont, setLocale],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);

  if (!context) {
    throw new Error('usePreferences must be used within AppPreferencesProvider');
  }

  return context;
}
