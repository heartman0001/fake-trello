'use client';

import { useRouter } from 'next/navigation';
import CardDetailRoute from '@/components/card-modal/CardDetailRoute';

interface InterceptedCardPageProps {
  params: {
    boardId: string;
    cardId: string;
  };
}

export default function InterceptedCardPage({ params }: InterceptedCardPageProps) {
  const router = useRouter();

  return (
    <CardDetailRoute
      boardId={params.boardId}
      cardId={params.cardId}
      variant="overlay"
      onClose={() => router.back()}
    />
  );
}
