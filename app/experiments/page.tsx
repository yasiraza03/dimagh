import type { Metadata } from 'next';
import { ExperimentGallery } from '@/components/experiments/ExperimentGallery';

export const metadata: Metadata = {
  title: 'Experiments',
  description:
    'Eight demonstrations — Müller-Lyer, checker-shadow, Kanizsa, colour contrast, motion aftereffect, change blindness, Stroop and visual capture of speech — where what you perceive and what the input contains come apart.',
};

export default function ExperimentsPage() {
  return <ExperimentGallery />;
}
