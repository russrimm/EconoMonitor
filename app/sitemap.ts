import type { MetadataRoute } from 'next';

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://economonitor.azurewebsites.net';

const ROUTES = [
  '',
  '/search',
  '/compare',
  '/builder',
  '/categories',
  '/releases',
  '/news',
  '/fraser',
  '/insights',
  '/chat',
  '/about',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: new URL(route || '/', SITE_URL).toString(),
    changeFrequency: route === '' || route === '/news' ? 'daily' : 'weekly',
  }));
}
