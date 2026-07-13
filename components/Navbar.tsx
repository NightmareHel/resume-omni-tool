'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { EASE } from '@/lib/ui';

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
    <nav className="sticky top-0 z-40 bg-quartz/85 backdrop-blur-md border-b border-seam px-6 h-14 flex items-center gap-1">
      <span className="text-graphite font-bold text-sm tracking-tight mr-6">JobPilot</span>
      {LINKS.map(({ href, label }) => {
        const active = path === href || (href !== '/' && path.startsWith(href));
        return (
          <Link
            key={href}
            href={href}
            className={`relative text-sm font-medium px-3 py-2 transition-colors ${
              active ? 'text-bronze-strong' : 'text-stone hover:text-graphite'
            }`}
          >
            {label}
            {active && (
              <motion.span
                layoutId="nav-underline"
                transition={{ duration: 0.3, ease: EASE }}
                className="absolute left-3 right-3 -bottom-[1px] h-[2px] bg-bronze rounded-full"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
