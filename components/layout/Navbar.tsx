'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart2,
  BookOpen,
  GitCompare,
  Info,
  List,
  MessageCircle,
  Moon,
  Search,
  Sparkles,
  Sun,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { useTheme } from './Providers';

const NAV = [
  { href: '/',           label: 'Dashboard',  icon: TrendingUp },
  { href: '/search',     label: 'Search',     icon: Search },
  { href: '/compare',    label: 'Compare',    icon: GitCompare },
  { href: '/categories', label: 'Categories', icon: List },
  { href: '/releases',   label: 'Releases',   icon: Tag },
  { href: '/fraser',     label: 'Archives',   icon: BookOpen },
  { href: '/insights',   label: 'Insights',   icon: Sparkles },
  { href: '/chat',        label: 'Chat',       icon: MessageCircle },
  { href: '/about',      label: 'About',      icon: Info },
];

export function Navbar() {
  const { dark, toggle } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const [query, setQuery] = useState('');

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setQuery('');
    }
  }

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Main bar */}
      <div className="mx-auto max-w-7xl px-4 flex items-center h-14 gap-3">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 font-bold text-lg tracking-tight whitespace-nowrap shrink-0"
          style={{ color: 'var(--accent)' }}
        >
          <BarChart2 className="w-5 h-5" />
          EconoMonitor
        </Link>

        {/* Search — hidden on /search since that page has its own full search bar */}
        {!pathname.startsWith('/search') && (
        <form onSubmit={handleSearch} className="flex-1 max-w-sm relative">
          <Search
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search economic series…"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg focus:outline-none focus:ring-2"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              // @ts-expect-error css var
              '--tw-ring-color': 'var(--accent)',
            }}
          />
        </form>
        )}

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-0.5 ml-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={{
                  background: active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-muted)',
                }}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          aria-label="Toggle dark mode"
          className="ml-auto p-1.5 rounded-md transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile nav */}
      <div
        className="md:hidden flex border-t overflow-x-auto"
        style={{ borderColor: 'var(--border)' }}
      >
        {NAV.map(({ href, label, icon: Icon }) => {
          const active =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-col items-center gap-0.5 px-4 py-2 text-xs font-medium flex-1 whitespace-nowrap"
              style={{ color: active ? 'var(--accent)' : 'var(--text-muted)' }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
