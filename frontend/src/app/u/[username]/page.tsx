import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import PublicProfile, { type PublicProfileData } from '@/components/PublicProfile';
import { levelFor, modeLabel } from '@/lib/format';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const loadProfile = cache(async (username: string): Promise<PublicProfileData | null> => {
  const sb = getServerSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc('public_profile', { p_username: username });
  if (error || !data) return null;
  return data as PublicProfileData;
});

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const p = await loadProfile(username);
  if (!p) return { title: 'perfil no encontrado · tecla*' };
  const best = p.best_tests[0];
  const name = p.display_name || p.username;
  const description = `Nivel ${levelFor(p.points).lv} · ${p.points.toLocaleString('es')} puntos` + (best ? ` · mejor test ${Math.round(best.wpm)} ppm en ${modeLabel(best.mode_key)}` : '');
  return {
    title: `${name} (@${p.username}) · tecla*`,
    description,
    openGraph: { title: `${name} en tecla*`, description, type: 'profile' },
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const { username } = await params;
  const p = await loadProfile(username);
  if (!p) notFound();
  return <PublicProfile p={p} />;
}
