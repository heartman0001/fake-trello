'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteCookie } from 'cookies-next';
import {
  ArrowLeft,
  Camera,
  Check,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  LogOut,
  Palette,
  Save,
  ShieldCheck,
  Type,
  UserRound,
} from 'lucide-react';
import type { User } from '@fake-trello/shared';
import UserAvatar from '@/components/ui/UserAvatar';
import { api } from '@/lib/api';
import type { FontChoice, Locale, TranslationKey } from '@/lib/i18n';
import { usePreferences } from '@/lib/preferences';
import { clearClientSession } from '@/lib/session';
import { useAuthStore } from '@/store/useAuthStore';

type Feedback = { tone: 'success' | 'error'; text: string } | null;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Unable to read that image'));
    image.src = src;
  });
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Unable to read that image'));
    reader.readAsDataURL(file);
  });
}

async function createAvatar(file: File) {
  if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
    throw new Error('invalid-type');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('too-large');
  }

  const image = await loadImage(await readFile(file));
  const size = 256;
  const sourceSize = Math.min(image.width, image.height);
  const sourceX = (image.width - sourceSize) / 2;
  const sourceY = (image.height - sourceSize) / 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to process that image');
  }

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    size,
    size,
  );

  return canvas.toDataURL('image/jpeg', 0.86);
}

function SettingsSection({
  id,
  icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="min-w-0 scroll-mt-24 rounded-2xl border border-gray-200 bg-white shadow-sm"
    >
      <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            {icon}
          </span>
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="mt-0.5 text-sm leading-relaxed text-gray-500">
              {description}
            </p>
          </div>
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { locale, font, setLocale, setFont, t } = usePreferences();
  const storedUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);

  const profileQuery = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get<User>('/auth/me'),
  });

  const user = profileQuery.data ?? storedUser;

  const [name, setName] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null);
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);
  const [preferenceFeedbackKey, setPreferenceFeedbackKey] =
    useState<TranslationKey | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const initializedFor = useRef<string | null>(null);

  useEffect(() => {
    if (profileQuery.data) {
      setUser(profileQuery.data);
    }
  }, [profileQuery.data, setUser]);

  useEffect(() => {
    if (!user || initializedFor.current === user.id) return;

    initializedFor.current = user.id;
    setName(user.name);
    setAvatarPreview(user.avatarUrl ?? null);
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: () =>
      api.patch<User>('/auth/me', {
        name: name.trim(),
        avatarUrl: avatarPreview,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile'], updated);
      setUser(updated);
      setAvatarPreview(updated.avatarUrl ?? null);
      setProfileFeedback({ tone: 'success', text: t('profileSaved') });
    },
    onError: (error) =>
      setProfileFeedback({
        tone: 'error',
        text: error instanceof Error ? error.message : t('profileSaved'),
      }),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      api.patch<{ success: boolean }>('/auth/me/password', {
        currentPassword,
        newPassword,
      }),
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFeedback({ tone: 'success', text: t('passwordUpdated') });
    },
    onError: (error) =>
      setPasswordFeedback({
        tone: 'error',
        text:
          error instanceof Error
            ? error.message
            : 'Unable to update your password',
      }),
  });

  const handleAvatarChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setAvatarError(null);

    try {
      setAvatarPreview(await createAvatar(file));
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setAvatarError(
        code === 'too-large'
          ? t('imageTooLarge')
          : code === 'invalid-type'
            ? t('imageInvalid')
            : 'Unable to process that image',
      );
    }
  };

  const handlePasswordSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordFeedback(null);

    if (newPassword.length < 8) {
      setPasswordFeedback({ tone: 'error', text: t('passwordTooShort') });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ tone: 'error', text: t('passwordMismatch') });
      return;
    }

    changePassword.mutate();
  };

  const handleSignOut = () => {
    queryClient.cancelQueries();
    deleteCookie('accessToken');
    deleteCookie('refreshToken');
    logout();
    clearClientSession(queryClient);
    router.push('/login');
    router.refresh();
  };

  const chooseLocale = (next: Locale) => {
    setLocale(next);
    setPreferenceFeedbackKey('languageChanged');
  };

  const chooseFont = (next: FontChoice) => {
    setFont(next);
    setPreferenceFeedbackKey('fontChanged');
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <p className="text-sm text-gray-500" role="status">
          {t('loading')}
        </p>
      </div>
    );
  }

  const fontOptions: Array<{
    id: FontChoice;
    label: string;
    description: string;
    family: string;
  }> = [
    {
      id: 'itim',
      label: t('fontItim'),
      description: t('fontItimDescription'),
      family: 'var(--font-itim)',
    },
    {
      id: 'sarabun',
      label: t('fontSarabun'),
      description: t('fontSarabunDescription'),
      family: 'var(--font-sarabun)',
    },
    {
      id: 'noto-sans-thai',
      label: t('fontNotoSansThai'),
      description: t('fontNotoSansThaiDescription'),
      family: 'var(--font-noto-sans-thai)',
    },
  ];

  const navItems = [
    { href: '#profile', label: t('profile'), icon: <UserRound className="h-4 w-4" /> },
    { href: '#security', label: t('security'), icon: <KeyRound className="h-4 w-4" /> },
    { href: '#appearance', label: t('appearance'), icon: <Palette className="h-4 w-4" /> },
    { href: '#session', label: t('session'), icon: <ShieldCheck className="h-4 w-4" /> },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#eff6ff_0,_#f9fafb_38%,_#f9fafb_100%)]">
      <header className="border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            href="/workspaces"
            className="inline-flex shrink-0 items-center gap-2 rounded-md px-1 py-1 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{t('backToWorkspaces')}</span>
            <span className="sm:hidden">{t('workspaces')}</span>
          </Link>

          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0 text-right">
              <p className="text-sm font-semibold text-gray-900">{t('settings')}</p>
              <p className="max-w-[45vw] truncate text-xs text-gray-500 sm:max-w-[18rem]">
                {user.email}
              </p>
            </div>
            <UserAvatar
              name={user.name}
              avatarUrl={user.avatarUrl}
              size="sm"
              className="ring-blue-100"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">
            {user.name}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-gray-950 sm:text-4xl">
            {t('settings')}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base">
            {t('settingsSubtitle')}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <aside className="min-w-0 space-y-4 lg:sticky lg:top-6">
            <div className="min-w-0 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-4">
                <UserAvatar
                  name={user.name}
                  avatarUrl={avatarPreview}
                  size="lg"
                  className="ring-4 ring-blue-50"
                />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-gray-900">
                    {user.name}
                  </p>
                  <p className="truncate text-xs text-gray-500">{user.email}</p>
                </div>
              </div>

              <nav
                aria-label={t('settingsNavigation')}
                className="mt-5 flex w-full min-w-0 gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible"
              >
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className="inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {item.icon}
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
              <div className="flex items-start gap-2.5">
                <Palette className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                <p className="text-xs leading-relaxed text-blue-900">
                  {t('fontDescription')}
                </p>
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <SettingsSection
              id="profile"
              icon={<UserRound className="h-[18px] w-[18px]" />}
              title={t('profile')}
              description={t('profileDescription')}
            >
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setProfileFeedback(null);
                  if (name.trim()) updateProfile.mutate();
                }}
                className="space-y-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="relative">
                    <UserAvatar
                      name={name || user.name}
                      avatarUrl={avatarPreview}
                      size="xl"
                      className="ring-4 ring-gray-100"
                    />
                    <label
                      htmlFor="avatar-upload"
                      className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-white bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-700 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2"
                      title={t('changePhoto')}
                    >
                      <Camera className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">{t('changePhoto')}</span>
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="sr-only"
                        onChange={handleAvatarChange}
                      />
                    </label>
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {t('profilePhoto')}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500">
                      {t('photoHint')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <label
                        htmlFor="avatar-upload"
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                        {t('changePhoto')}
                      </label>
                      {avatarPreview && (
                        <button
                          type="button"
                          onClick={() => {
                            setAvatarPreview(null);
                            setAvatarError(null);
                          }}
                          className="rounded-md px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          {t('removePhoto')}
                        </button>
                      )}
                    </div>
                    {avatarError && (
                      <p role="alert" className="mt-2 text-xs text-red-600">
                        {avatarError}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="settings-name"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      {t('displayName')}
                    </label>
                    <input
                      id="settings-name"
                      type="text"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={80}
                      autoComplete="name"
                      className="field"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="settings-email"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      {t('email')}
                    </label>
                    <input
                      id="settings-email"
                      type="email"
                      value={user.email}
                      readOnly
                      className="field cursor-not-allowed bg-gray-50 text-gray-500"
                      aria-describedby="settings-email-hint"
                    />
                    <p
                      id="settings-email-hint"
                      className="mt-1.5 text-xs text-gray-500"
                    >
                      {t('emailReadOnly')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={!name.trim() || updateProfile.isPending}
                    className="btn-primary"
                  >
                    <Save className="h-4 w-4" aria-hidden="true" />
                    {updateProfile.isPending ? t('saving') : t('saveChanges')}
                  </button>
                  {profileFeedback && (
                    <p
                      role="status"
                      className={
                        profileFeedback.tone === 'success'
                          ? 'text-sm text-emerald-600'
                          : 'text-sm text-red-600'
                      }
                    >
                      {profileFeedback.text}
                    </p>
                  )}
                </div>
              </form>
            </SettingsSection>

            <SettingsSection
              id="security"
              icon={<KeyRound className="h-[18px] w-[18px]" />}
              title={t('security')}
              description={t('securityDescription')}
            >
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowPasswords((visible) => !visible)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
                    aria-pressed={showPasswords}
                  >
                    {showPasswords ? (
                      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    {showPasswords ? t('hidePasswords') : t('showPasswords')}
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="current-password"
                    className="mb-1.5 block text-sm font-medium text-gray-700"
                  >
                    {t('currentPassword')}
                  </label>
                  <input
                    id="current-password"
                    type={showPasswords ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                    className="field"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="new-password"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      {t('newPassword')}
                    </label>
                    <input
                      id="new-password"
                      type={showPasswords ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                      minLength={8}
                      className="field"
                      required
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="confirm-password"
                      className="mb-1.5 block text-sm font-medium text-gray-700"
                    >
                      {t('confirmPassword')}
                    </label>
                    <input
                      id="confirm-password"
                      type={showPasswords ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      autoComplete="new-password"
                      minLength={8}
                      className="field"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={
                      changePassword.isPending ||
                      !currentPassword ||
                      !newPassword ||
                      !confirmPassword
                    }
                    className="btn-primary"
                  >
                    <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    {changePassword.isPending
                      ? t('saving')
                      : t('updatePassword')}
                  </button>
                  {passwordFeedback && (
                    <p
                      role="status"
                      className={
                        passwordFeedback.tone === 'success'
                          ? 'text-sm text-emerald-600'
                          : 'text-sm text-red-600'
                      }
                    >
                      {passwordFeedback.text}
                    </p>
                  )}
                </div>
              </form>
            </SettingsSection>

            <SettingsSection
              id="appearance"
              icon={<Palette className="h-[18px] w-[18px]" />}
              title={t('appearance')}
              description={t('appearanceDescription')}
            >
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-gray-500" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      {t('language')}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {t('languageDescription')}
                  </p>

                  <div
                    role="radiogroup"
                    aria-label={t('language')}
                    className="mt-3 grid max-w-md grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1"
                  >
                    {(
                      [
                        { id: 'th', label: t('thai'), short: 'TH' },
                        { id: 'en', label: t('english'), short: 'EN' },
                      ] as Array<{ id: Locale; label: string; short: string }>
                    ).map((option) => {
                      const selected = locale === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => chooseLocale(option.id)}
                          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                            selected
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-500 hover:text-gray-800'
                          }`}
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">
                            {option.short}
                          </span>
                          {option.label}
                          {selected && (
                            <Check className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <Type className="h-4 w-4 text-gray-500" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      {t('font')}
                    </h3>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {t('fontDescription')}
                  </p>

                  <div
                    role="radiogroup"
                    aria-label={t('font')}
                    className="mt-3 grid gap-2 sm:grid-cols-3"
                  >
                    {fontOptions.map((option) => {
                      const selected = font === option.id;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => chooseFont(option.id)}
                          className={`rounded-xl border p-3 text-left transition-all ${
                            selected
                              ? 'border-blue-500 bg-blue-50/70 shadow-sm ring-1 ring-blue-500'
                              : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/30'
                          }`}
                        >
                          <span
                            className="block text-2xl leading-none text-gray-900"
                            style={{ fontFamily: option.family }}
                          >
                            Aa กก
                          </span>
                          <span className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-gray-900">
                              {option.label}
                            </span>
                            {selected && (
                              <Check
                                className="h-4 w-4 shrink-0 text-blue-600"
                                aria-hidden="true"
                              />
                            )}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-gray-500">
                            {option.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {preferenceFeedbackKey && (
                  <p role="status" className="text-xs text-emerald-600">
                    {t(preferenceFeedbackKey)}
                  </p>
                )}
              </div>
            </SettingsSection>

            <SettingsSection
              id="session"
              icon={<ShieldCheck className="h-[18px] w-[18px]" />}
              title={t('session')}
              description={t('sessionDescription')}
            >
              <div className="flex flex-col gap-4 rounded-xl border border-red-100 bg-red-50/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {t('signOut')}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600">
                    {t('signOutDescription')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  {t('signOut')}
                </button>
              </div>
            </SettingsSection>
          </div>
        </div>
      </main>
    </div>
  );
}
