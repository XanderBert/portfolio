// /portfolio/llms-full.txt: the profile from llms.txt followed by the full text
// of every work post, in one file an AI assistant can read in a single request.
import type { APIRoute } from 'astro';
import { getWorks } from '../lib/site';
import { abs, absolutizeMarkdown } from '../lib/seo';
import { profileMarkdown } from '../lib/llms';

export const GET: APIRoute = async () => {
  const works = await getWorks();
  const posts = works.map((w) => {
    const d = w.data;
    return `---

# ${d.title}

URL: ${abs(`work/${w.id}/`)}
Date: ${d.date.toISOString().slice(0, 10)}
Tags: ${d.tags.join(', ')}${d.github ? `\nSource code: ${d.github}` : ''}
${d.facts.map((f) => `${f.label}: ${f.value}`).join('\n')}

${d.summary}

${absolutizeMarkdown(w.body ?? '').trim()}
`;
  });
  return new Response(`${await profileMarkdown()}\n${posts.join('\n')}`, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
