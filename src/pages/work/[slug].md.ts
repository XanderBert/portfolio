// /portfolio/work/<slug>.md: each post as clean Markdown, for AI assistants
// that prefer text over the 3D page. Linked from llms.txt.
import type { APIRoute, GetStaticPaths } from 'astro';
import type { CollectionEntry } from 'astro:content';
import site from '../../data/site.json';
import { getWorks } from '../../lib/site';
import { abs, absolutizeMarkdown } from '../../lib/seo';

export const getStaticPaths = (async () => {
  const works = await getWorks();
  return works.map((w) => ({ params: { slug: w.id }, props: { work: w } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const w = (props as { work: CollectionEntry<'work'> }).work;
  const d = w.data;
  const md = `# ${d.title}

By ${site.name} (${site.role}), ${d.date.toISOString().slice(0, 10)}. ${abs(`work/${w.id}/`)}
${d.github ? `Source code: ${d.github}\n` : ''}${d.tags.length ? `Tags: ${d.tags.join(', ')}\n` : ''}
> ${d.summary}

${absolutizeMarkdown(w.body ?? '').trim()}
`;
  return new Response(md, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
};
