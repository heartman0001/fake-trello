'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { setCookie } from 'cookies-next';
import { api } from '@/lib/api';
import { usePreferences } from '@/lib/preferences';
import { clearClientSession } from '@/lib/session';
import { useAuthStore } from '@/store/useAuthStore';
import type { AuthResponse } from '@/types';

export default function RegisterPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = usePreferences();
  const setUser = useAuthStore((state) => state.setUser);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await api.post<AuthResponse>('/auth/register', {
        name,
        email,
        password,
      });

      clearClientSession(queryClient);
      setCookie('accessToken', result.accessToken, { maxAge: 60 * 60 * 24 * 7 });
      setCookie('refreshToken', result.refreshToken, {
        maxAge: 60 * 60 * 24 * 30,
      });
      setUser(result.user);
      router.push('/workspaces');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">
            FT
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">
            {t('createAccount')}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('createAccountSubtitle')}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-surface space-y-4 p-6">
          <div>
            <label
              htmlFor="name"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              {t('name')}
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              {t('email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="field"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full"
          >
            {isSubmitting ? t('creatingAccount') : t('createAccountAction')}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          {t('alreadyRegistered')}{' '}
          <Link
            href="/login"
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            {t('signInLink')}
          </Link>
        </p>
      </div>
    </main>
  );
}
