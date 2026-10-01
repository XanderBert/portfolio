// /portfolio/robots.txt. Note: crawlers only read robots.txt at the domain root
// (xanderbert.github.io/robots.txt, served by the blog repo). See README, "SEO".
// This copy documents the intent and is what you'd use on a custom domain.
import type { APIRoute } from 'astro';
import { abs } from '../lib/seo';

export const GET: APIRoute = () =>
  new Response(`# Search engines and AI assistants are welcome.
User-agent: *
Allow: /
Disallow: /portfolio/admin/

Sitemap: ${abs('sitemap.xml')}
`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
