import type { Metadata } from 'next';
import { ScienceContent } from '@/components/science/ScienceContent';

export const metadata: Metadata = {
  title: 'Science',
  description:
    'Every claim in dimagh, labelled as known, simplified or conceptual — plus how the brain is drawn, why time is stretched, and what this project explicitly is not.',
};

export default function SciencePage() {
  return <ScienceContent />;
}
