import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Itim, Noto_Sans_Thai, Sarabun } from 'next/font/google';
import './globals.css';
import {
  DEFAULT_FONT,
  DEFAULT_LOCALE,
  FONT_COOKIE,
  LOCALE_COOKIE,
  isFontChoice,
  isLocale,
} from '@/lib/i18n';
import { AppPreferencesProvider } from '@/lib/preferences';
import Providers from './providers';

const itim = Itim({
  subsets: ['latin', 'thai'],
  weight: '400',
  display: 'swap',
  variable: '--font-itim',
});

const sarabun = Sarabun({
  subsets: ['latin', 'thai'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-sarabun',
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ['latin', 'thai'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-noto-sans-thai',
});

export const metadata: Metadata = {
  title: 'Fake Trello',
  description: 'Real-time Kanban boards',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  const fontCookie = cookieStore.get(FONT_COOKIE)?.value;
  const locale = isLocale(localeCookie) ? localeCookie : DEFAULT_LOCALE;
  const font = isFontChoice(fontCookie) ? fontCookie : DEFAULT_FONT;

  return (
    <html
      lang={locale}
      data-font={font}
      className={`${itim.variable} ${sarabun.variable} ${notoSansThai.variable}`}
    >
      <body>
        <AppPreferencesProvider initialLocale={locale} initialFont={font}>
          <Providers>{children}</Providers>
        </AppPreferencesProvider>
      </body>
    </html>
  );
}
