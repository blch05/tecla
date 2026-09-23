import GameRoom from '@/components/GameRoom';

export const metadata = { title: 'sala online · tecla*', description: 'Te invitaron a una sala de tecla*: arcade multijugador y battle royale de tipeo.' };

const GAMES = ['bombas', 'runner', 'caen', 'torre', 'royale'] as const;
type GameKey = (typeof GAMES)[number];

export default async function SalaPage({ params, searchParams }: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ juego?: string; privada?: string }>;
}) {
  const { code } = await params;
  const sp = await searchParams;
  const clean = code.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'sala';
  const game: GameKey = (GAMES as readonly string[]).includes(sp.juego || '') ? (sp.juego as GameKey) : 'bombas';
  return <GameRoom code={clean} initialGame={game} initialPublic={sp.privada !== '1'} />;
}
