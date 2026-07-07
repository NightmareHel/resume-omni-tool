'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/',         label: 'Dashboard' },
  { href: '/jobs',     label: 'Jobs' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/resume',   label: 'Resume' },
  { href: '/profile',  label: 'Profile' },
  { href: '/emails',   label: 'Emails' },
];

export default function Navbar() {
  const path = usePathname();
  return (
    <nav className="bg-zinc-950 border-b border-zinc-800 px-6 py-3 flex items-center gap-1">
      <span className="text-zinc-100 font-bold text-sm tracking-wide mr-5">JobPilot</span>
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
            path === href || (href !== '/' && path.startsWith(href))
              ? 'text-emerald-400 bg-emerald-950/50'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
