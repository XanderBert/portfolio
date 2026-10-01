import { getCollection, type CollectionEntry } from 'astro:content';

/** Prefix a site-relative path with the configured base (/portfolio). */
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (/^https?:\/\//.test(path)) return path;
  return `${base}/${path.replace(/^\//, '')}`;
}

export const CATEGORIES = {
  graphics: { label: 'Graphics Programming', color: '#86E0B8' },
  tools: { label: 'Tool Development', color: '#9CC7FF' },
  games: { label: 'Games', color: '#FFB870' },
  awards: { label: 'Awards', color: '#F0D98C' },
  other: { label: 'Other', color: '#C9B8FF' },
} as const;

export type Category = keyof typeof CATEGORIES;

/** All published works, newest first. */
export async function getWorks(): Promise<CollectionEntry<'work'>[]> {
  const all = await getCollection('work', ({ data }) => !data.draft);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export function repoName(github: string): string {
  return github.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
}

/** Rough GitHub-style language colors for the repo card. */
export const LANG_COLORS: Record<string, string> = {
  'C++': '#F34B7D', C: '#555555', 'C#': '#178600', GLSL: '#5686A5', HLSL: '#AACE60',
  Slang: '#1FBFB8', WGSL: '#005A9C', TypeScript: '#3178C6', JavaScript: '#F1E05A',
  Python: '#3572A5', Rust: '#DEA584', CMake: '#DA3434',
};
