'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUser } from '@/lib/useHistory';
import PillNav from '@/components/bits/PillNav';
import DecryptedText from '@/components/bits/DecryptedText';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { useShopState } from '@/lib/shop/client';

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
  const user = useUser();

  const active = LINKS.find(l => pathname.startsWith(l.href))?.href;
  const balance = useShopState(s => s.state?.balance ?? null);

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
      {balance != null && <Link className="wallet" href="/tienda" title="tus teclas* · ir a la tienda">✱ <b>{balance.toLocaleString('es')}</b></Link>}
      <Link className="auth" href={user ? '/perfil' : '/login'}>
        {user ? (
          user.avatarUrl
            ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
            : <span className="ini">{user.name[0]?.toUpperCase()}</span>
        ) : null}
        <span>{user ? user.name : 'entrar'}</span>
      </Link>
    </header>
  );
}
