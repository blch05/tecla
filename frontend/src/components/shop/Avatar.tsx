'use client';

/* Avatar del perfil: el avatar de la tienda si hay uno puesto, si no la foto, si no la inicial. */
import { useEffect, useState } from 'react';
import { avatarUri } from '@/lib/shop/avatar';

export default function Avatar({ url, name, style, seed, frame, className = '' }: {
  url?: string | null; name: string; style?: string; seed: string; frame?: string; className?: string;
}) {
  const [gen, setGen] = useState<string | null>(null);
  useEffect(() => {
    setGen(null); let alive = true;
    avatarUri(style || '', seed)?.then(u => { if (alive) setGen(u); }).catch(() => {});
    return () => { alive = false; };
  }, [style, seed]);
  const src = gen || url;
  return (
    <div className={('avatar ' + className).trim()} data-frame={frame || undefined}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" referrerPolicy="no-referrer" className={gen ? 'gen' : undefined} /> : <span>{name[0]?.toUpperCase() || 'V'}</span>}
    </div>
  );
}
