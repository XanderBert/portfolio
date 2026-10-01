import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// One Markdown file per work in src/content/work/. The file name becomes the URL: /work/<file-name>/
// Edit these by hand or through the CMS at /portfolio/admin/.
const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    categories: z.array(z.enum(['graphics', 'tools', 'games', 'awards', 'other'])).min(1),
    tags: z.array(z.string()).default([]),
    summary: z.string(),
    cover: z.string().optional().default(''),
    github: z.string().optional().default(''),
    languages: z.array(z.string()).default([]),
    links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
    facts: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

// Adding research later: copy the block above as `research`, point it at src/content/research,
// add a page in src/pages/research/ and a nav link in src/components/Nav.astro. See README.md.

export const collections = { work };
