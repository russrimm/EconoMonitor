import Link from 'next/link';
import {
  BarChart2,
  BookOpen,
  GitCompare,
  Globe,
  Linkedin,
  LineChart,
  List,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Static page — no 'use client' needed, no data fetching
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: TrendingUp,
    title: 'Dashboard',
    href: '/',
    description:
      'Personalised overview of up to 6 pinned economic indicators, each with a live sparkline and the latest value. Upcoming data releases are listed at the bottom.',
  },
  {
    icon: Search,
    title: 'Series Search',
    href: '/search',
    description:
      'Full-text search across hundreds of thousands of economic and financial series — from unemployment and inflation to mortgage rates, trade balances, and commodity prices. Browse by topic or drill down through category hierarchies.',
  },
  {
    icon: LineChart,
    title: 'Series Detail',
    href: '/search',
    description:
      'Interactive time-series chart with 1Y / 5Y / 10Y / Max range picker, complete metadata, series notes, pin/compare shortcuts, and CSV / JSON export.',
  },
  {
    icon: GitCompare,
    title: 'Compare',
    href: '/compare',
    description:
      'Overlay up to 6 series on a single dual-axis chart. Series with different units receive separate Y-axes. Supports the pinned-series quick-pick dropdown.',
  },
  {
    icon: List,
    title: 'Categories',
    href: '/categories',
    description:
      'Browse economic data by topic — drill from top-level themes such as Money & Banking, National Accounts, Labour Markets, and International Trade down to individual series within any sub-category.',
  },
  {
    icon: Tag,
    title: 'Releases',
    href: '/releases',
    description:
      'Calendar of upcoming scheduled data releases — GDP revisions, employment reports, CPI prints, Fed meeting minutes, and more — sorted chronologically so you never miss a market-moving data point.',
  },
  {
    icon: BookOpen,
    title: 'FRASER Archive',
    href: '/fraser',
    description:
      'Browse the Federal Reserve Archival System for Economic Research — thousands of historical documents, themes, and economic timelines spanning 150+ years.',
  },
  {
    icon: Sparkles,
    title: 'AI Insights',
    href: '/insights',
    description:
      'Select any combination of economic or financial series and generate a structured analysis powered by AI, streamed live. Identifies trends, correlations, anomalies, and the current macroeconomic state — useful for research, investment analysis, and policy review.',
  },
];

const MICROSOFT_TECH = [
  {
    name: 'TypeScript',
    logo: '🔷',
    category: 'Language',
    description:
      'The entire codebase is written in TypeScript — Microsoft\'s open-source, strongly-typed superset of JavaScript. Strict mode is enabled throughout, catching type errors at compile time rather than runtime.',
    link: 'https://www.typescriptlang.org',
  },
  {
    name: 'Visual Studio Code',
    logo: '🖥️',
    category: 'Editor',
    description:
      'Built entirely inside VS Code — Microsoft\'s free, open-source code editor. Extensions such as ESLint, Tailwind IntelliSense, and the Azure Cosmos DB connector were used during development.',
    link: 'https://code.visualstudio.com',
  },
  {
    name: 'GitHub Copilot',
    logo: '🤖',
    category: 'AI Development',
    description:
      'Every component, hook, route, and type in EconoMonitor was pair-programmed with GitHub Copilot — Microsoft\'s AI coding assistant. Copilot generated initial implementations, caught errors, and iterated on architecture in real time.',
    link: 'https://github.com/features/copilot',
  },
  {
    name: 'GitHub',
    logo: '🐙',
    category: 'Platform',
    description:
      'Source code is hosted on GitHub — a Microsoft company. GitHub Actions can be used to automate CI/CD pipelines for linting, type checking, and deploying the app.',
    link: 'https://github.com',
  },
  {
    name: 'GitHub Models',
    logo: '✨',
    category: 'AI Inference',
    description:
      'The AI Insights feature calls a frontier language model through the GitHub Models free inference API (endpoint: models.inference.ai.azure.com) — a GitHub product backed by Microsoft Azure. Responses stream directly to the browser.',
    link: 'https://github.com/marketplace/models',
  },
  {
    name: 'Azure OpenAI Service',
    logo: '☁️',
    category: 'AI (optional upgrade)',
    description:
      'EconoMonitor\'s AI route is pre-wired for Azure OpenAI — set three environment variables and all AI calls route through your private Azure deployment instead of the shared GitHub Models endpoint. Same code; no changes required.',
    link: 'https://azure.microsoft.com/products/ai-services/openai-service',
  },
  {
    name: 'Microsoft AI Foundry',
    logo: '🏭',
    category: 'AI Platform (optional)',
    description:
      'For enterprise deployments, the AI route is compatible with Microsoft AI Foundry, adding managed monitoring, prompt evaluation, safety filters, and quota governance on top of the Azure OpenAI backend.',
    link: 'https://ai.azure.com',
  },
];

const DATA_SOURCES = [
  {
    name: 'FRED',
    full: 'Federal Reserve Economic Data',
    org: 'Federal Reserve Bank of St. Louis',
    description:
      'Over 800 000 economic and financial time series covering national accounts (GDP, GNI), labour markets (unemployment, wages, participation), prices (CPI, PCE, PPI), interest rates, money supply, banking, housing, trade, and international finance — updated as frequently as daily. Widely used by economists, investors, policymakers, journalists, and researchers.',
    url: 'https://fred.stlouisfed.org',
  },
  {
    name: 'FRASER',
    full: 'Federal Reserve Archival System for Economic Research',
    org: 'Federal Reserve Bank of St. Louis',
    description:
      'Primary-source historical archive: Federal Reserve annual reports, Banking and Monetary Statistics volumes, oral histories, congressional testimonies, and thematic economic timelines stretching back to the 1800s.',
    url: 'https://fraser.stlouisfed.org',
  },
];

const STACK = [
  { name: 'Next.js 16', role: 'React framework (App Router)' },
  { name: 'React 19', role: 'UI library' },
  { name: 'Tailwind CSS v4', role: 'Utility-first styling' },
  { name: 'Chart.js 4 + react-chartjs-2', role: 'Canvas-rendered charts' },
  { name: 'TanStack Query v5', role: 'Server state & caching' },
  { name: 'OpenAI Node SDK', role: 'Streaming AI inference' },
  { name: 'date-fns 4', role: 'Date formatting' },
  { name: 'lucide-react', role: 'Icon library' },
];

export default function AboutPage() {
  return (
    <div className="flex flex-col gap-12 pb-12">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl px-8 py-12 flex flex-col gap-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <BarChart2 className="w-9 h-9" style={{ color: 'var(--accent)' }} />
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            EconoMonitor
          </h1>
        </div>
        <p className="text-lg max-w-2xl leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          A professional-grade economic research dashboard built with modern web technology
          and AI. Explore hundreds of thousands of economic and financial time series spanning
          GDP, employment, inflation, interest rates, housing, trade, and more — browse
          150 years of Federal Reserve archives, compare indicators side-by-side, and let
          let AI surface insights hidden in the data.
        </p>
        <div className="flex gap-3 flex-wrap mt-2">
          <Link
            href="/"
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            Open Dashboard
          </Link>
          <Link
            href="/insights"
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            Try AI Insights
          </Link>
          <a
            href="https://www.linkedin.com/in/russrimm"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5"
            style={{ background: 'var(--surface-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
          >
            <Linkedin className="w-4 h-4" style={{ color: '#0a66c2' }} />
            Connect on LinkedIn
          </a>
        </div>
      </div>

      {/* ── Creator ──────────────────────────────────────────────────── */}
      <section
        className="rounded-2xl px-8 py-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-8"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {/* Avatar placeholder */}
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center shrink-0 text-2xl font-bold select-none"
          style={{
            background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
            color: 'var(--accent)',
            border: '2px solid color-mix(in srgb, var(--accent) 30%, transparent)',
          }}
        >
          RR
        </div>

        <div className="flex flex-col gap-3 flex-1">
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Russ Rimmerman</h2>
            <p className="text-sm" style={{ color: 'var(--accent)' }}>Microsoft Cloud Solution Architect · Agentic AI Enthusiast</p>
          </div>

          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Russ is a Microsoft Cloud Solution Architect with a passion for building intelligent,
            data-driven tools using agentic coding workflows. He leverages GitHub Copilot and
            agent-mode prompting to design and ship full-stack applications end-to-end — from
            data architecture and API integration to polished UI — in a fraction of the time
            traditional development cycles would require.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            EconoMonitor is one of several agentic creations in his portfolio: applications where
            the developer steers the vision and an AI pair-programmer handles the implementation
            detail. His interests span macroeconomics, cloud architecture, AI model evaluation,
            developer tooling, and the intersection of large language models with real-world
            economic and financial datasets.
          </p>

          <a
            href="https://www.linkedin.com/in/russrimm"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{
              background: '#0a66c2',
              color: '#fff',
            }}
          >
            <Linkedin className="w-4 h-4" />
            linkedin.com/in/russrimm
          </a>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-5">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {FEATURES.map(({ icon: Icon, title, href, description }) => (
            <Link
              key={title}
              href={href}
              className="rounded-xl p-5 flex flex-col gap-3 transition-colors group"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}
              >
                <Icon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
              </div>
              <div>
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>
                  {title}
                </p>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Microsoft Technologies ───────────────────────────────────── */}
      <section className="flex flex-col gap-5">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
            Built with Microsoft Technology
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            EconoMonitor was designed, written, and AI-powered entirely within the Microsoft
            and GitHub ecosystem.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MICROSOFT_TECH.map(({ name, logo, category, description, link }) => (
            <a
              key={name}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl p-5 flex flex-col gap-3 transition-opacity hover:opacity-90"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{logo}</span>
                  <div>
                    <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text)' }}>
                      {name}
                    </p>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded mt-0.5 inline-block"
                      style={{
                        background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                        color: 'var(--accent)',
                      }}
                    >
                      {category}
                    </span>
                  </div>
                </div>
                <Globe className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {description}
              </p>
            </a>
          ))}
        </div>
      </section>

      {/* ── Data Sources ─────────────────────────────────────────────── */}
      <section className="flex flex-col gap-5">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Data Sources</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DATA_SOURCES.map(({ name, full, org, description, url }) => (
            <a
              key={name}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl p-6 flex flex-col gap-2 transition-opacity hover:opacity-90"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-sm font-bold font-mono px-2 py-0.5 rounded"
                  style={{
                    background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                    color: 'var(--accent)',
                  }}
                >
                  {name}
                </span>
                <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="text-sm font-semibold leading-snug" style={{ color: 'var(--text)' }}>
                {full}
              </p>
              <p className="text-xs" style={{ color: 'var(--accent)', opacity: 0.8 }}>
                {org}
              </p>
              <p className="text-xs leading-relaxed mt-1" style={{ color: 'var(--text-muted)' }}>
                {description}
              </p>
            </a>
          ))}
        </div>
      </section>

      {/* ── Tech Stack ───────────────────────────────────────────────── */}
      <section className="flex flex-col gap-5">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Tech Stack</h2>
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border)' }}
        >
          {STACK.map(({ name, role }, i) => (
            <div
              key={name}
              className="flex items-center justify-between px-5 py-3 text-sm"
              style={{
                background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span className="font-medium" style={{ color: 'var(--text)' }}>
                {name}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>{role}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer note ──────────────────────────────────────────────── */}
      <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
        EconoMonitor is an independent research tool. It is not affiliated with, endorsed
        by, or sponsored by the Federal Reserve Bank of St. Louis, Microsoft, or GitHub.
        Data is provided by the FRED and FRASER public APIs under their respective terms
        of service.
      </p>

    </div>
  );
}
