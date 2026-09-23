import LiveRace from '@/components/LiveRace';

export const metadata = { title: 'carrera en vivo · tecla*', description: 'Te invitaron a una carrera de tipeo en vivo.' };

export default async function CarreraPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ privada?: string }> }) {
  const { code } = await params;
  const { privada } = await searchParams;
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'sala';
  return <LiveRace code={clean} initialPublic={privada !== '1'} />;
}
