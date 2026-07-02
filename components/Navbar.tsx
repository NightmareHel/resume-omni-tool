'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/',         label: 'Resume' },
  { href: '/jobs',     label: 'Jobs' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/profile',  label: 'Profile' },
  { href: '/emails',   label: 'Emails' },
];

export default function Navbar() {
  const path = usePathname();
  return (
    <nav className="bg-zinc-900 border-b border-zinc-800 px-6 py-3 flex items-center gap-6">
      <span className="text-zinc-100 font-bold text-sm tracking-wide mr-4">JobPilot</span>
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          className={`text-sm font-medium transition-colors ${path === href ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-100'}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
