import type { Metadata } from 'next';
import { BrainViewer } from '@/components/brain/BrainViewer';

export const metadata: Metadata = {
  title: 'Brain',
  description:
    'An interactive 3D brain with 35 regions, seven visual lenses, and an inspector for every region — what it does, why it matters, and what the visualisation simplifies.',
};

export default function BrainPage() {
  return <BrainViewer />;
}
