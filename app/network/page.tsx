import type { Metadata } from 'next';
import { NetworkMode } from '@/components/brain/NetworkMode';

export const metadata: Metadata = {
  title: 'Network',
  description:
    'Anatomy recedes and the brain becomes nodes and pathways. Search a function — memory, attention, movement — and watch the relevant systems illuminate.',
};

export default function NetworkPage() {
  return <NetworkMode />;
}
