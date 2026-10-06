import type { Metadata } from 'next';
import { NeuralLab } from '@/components/lab/NeuralLab';

export const metadata: Metadata = {
  title: 'Lab',
  description:
    'Change attention, distraction, novelty, memory load, sensory noise and task difficulty, and watch the same simulation engine respond. Conceptual dials, not measurements.',
};

export default function LabPage() {
  return <NeuralLab />;
}
