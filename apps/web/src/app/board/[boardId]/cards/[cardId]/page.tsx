'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import CardDetailRoute from '@/components/card-modal/CardDetailRoute';

interface CardPageProps {
  params: {
    boardId: string;
    cardId: string;
  };
}

export default function CardPage({ params }: CardPageProps) {
  const router = useRouter();
  const boardHref = `/board/${params.boardId}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-4 sm:px-6">
          <Link
            href={boardHref}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to board
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <CardDetailRoute
          boardId={params.boardId}
          cardId={params.cardId}
          variant="page"
          onClose={() => router.push(boardHref)}
        />
      </main>
    </div>
  );
}
