'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { HistoryUser } from '@/lib/tecla/history';
import PillNav from '@/components/bits/PillNav';
import DecryptedText from '@/components/bits/DecryptedText';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { useShop } from '@/lib/shop/client';

const LINKS = [
  { href: '/test', label: 'test' },
  { href: '/competir', label: 'competir' },
  { href: '/arcade', label: 'arcade' },
  { href: '/estudiar', label: 'estudiar' },
  { href: '/ranking', label: 'ranking' },
  { href: '/progreso', label: 'progreso' },
  { href: '/tienda', label: 'tienda' },
  { href: '/perfil', label: 'perfil' },
];

export default function Header() {
  const pathname = usePathname() || '/';
  const [user, setUser] = useState<HistoryUser | null>(null);

  useEffect(() => {
    let unsub = () => {};
    import('@/lib/tecla/history').then(({ History }) => {
      const sync = () => setUser(History.user ? { ...History.user } : null);
      sync();
      unsub = History.subscribe(sync);
    });
    return () => unsub();
  }, []);

  const active = LINKS.find(l => pathname.startsWith(l.href))?.href;
  const shop = useShop();

  return (
    <header className="top">
      <PillNav
        logo={
          <span className="logo">
            <DecryptedText
              text="tecla"
              animateOn="view"
              sequential
              speed={45}
              characters="abcdefghijklmnñopqrstuvwxyz*—|"
              encryptedClassName="logo-scramble"
            />
            <b>*</b>
          </span>
        }
        logoHref="/"
        items={LINKS}
        activeHref={active}
        baseColor="var(--accent)"
        pillColor="var(--soft)"
        pillTextColor="var(--sub)"
        hoveredPillTextColor="#FFFFFF"
        ease="power2.easeOut"
        initialLoadAnimation={false}
      />
      <div className="bars" aria-hidden="true" />
      <ThemeSwitcher />
      {shop.state && <Link className="wallet" href="/tienda" title="tus teclas* · ir a la tienda">✱ <b>{shop.state.balance.toLocaleString('es')}</b></Link>}
      <Link className="auth" href={user ? '/perfil' : '/login'}>
        {user ? (
          user.avatarUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
            : <span className="ini">{user.name[0]?.toUpperCase()}</span>
        ) : null}
        <span>{user ? user.name : 'entrar'}</span>
      </Link>
    </header>
  );
}
