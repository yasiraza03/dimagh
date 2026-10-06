import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SCENARIOS, getScenario } from '@/lib/simulation/scenarios';
import { ScenarioPlayer } from '@/components/simulation/ScenarioPlayer';

/** Every scenario is prerendered — there is no dynamic data anywhere. */
export function generateStaticParams() {
  return SCENARIOS.map((s) => ({ id: s.id }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const s = getScenario(id);
  if (!s) return { title: 'Not found' };
  return {
    title: s.title,
    description: `${s.question} ${s.teaser}`,
    openGraph: { title: `${s.title} — dimagh`, description: s.teaser },
  };
}

export default async function ScenarioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ stage?: string }>;
}) {
  const { id } = await params;
  const { stage } = await searchParams;
  const scenario = getScenario(id);
  if (!scenario) notFound();

  return <ScenarioPlayer scenarioId={scenario.id} initialStage={stage} />;
}
