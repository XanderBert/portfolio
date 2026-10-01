// /portfolio/sitemap.xml: every public page, for search engines.
import type { APIRoute } from 'astro';
import { getWorks } from '../lib/site';
import { abs } from '../lib/seo';

export const GET: APIRoute = async () => {
  const works = await getWorks();
  const newest = works[0]?.data.date.toISOString().slice(0, 10);
  const pages = [
    { loc: abs(''), lastmod: newest, priority: '1.0' },
    { loc: abs('about/'), priority: '0.9' },
    { loc: abs('work/'), lastmod: newest, priority: '0.9' },
    ...works.map((w) => ({
      loc: abs(`work/${w.id}/`),
      lastmod: w.data.date.toISOString().slice(0, 10),
      priority: w.data.featured ? '0.8' : '0.6',
      image: w.data.cover ? abs(w.data.cover) : '',
    })),
  ];
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages.map((p) => `  <url>
    <loc>${esc(p.loc)}</loc>${p.lastmod ? `\n    <lastmod>${p.lastmod}</lastmod>` : ''}
    <priority>${p.priority}</priority>${'image' in p && p.image ? `\n    <image:image><image:loc>${esc(p.image)}</image:loc></image:image>` : ''}
  </url>`).join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
