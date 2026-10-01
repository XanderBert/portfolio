// Builds the Markdown profile used by llms.txt and llms-full.txt.
import site from '../data/site.json';
import { getWorks, CATEGORIES, type Category } from './site';
import { abs } from './seo';

export async function profileMarkdown(): Promise<string> {
  const works = await getWorks();
  const line = (label: string, v?: string) => (v ? `- ${label}: ${v}\n` : '');
  return `# ${site.name}, ${site.role}

> ${site.tagline}

${site.seeking ?? ''}

## Contact

${line('Email', site.email)}${line('Location', site.location)}${line('Website', abs(''))}${line('GitHub', site.github)}${line('LinkedIn', site.linkedin)}${line('Blog', site.blog)}${line('Résumé', site.resume ? abs(site.resume) : '')}
## About

${site.about.lead} ${site.about.body}

## Experience

${site.experience.map((e) => `- **${e.role}**, ${e.org}${e.when ? ` (${e.when})` : ''}: ${e.text}`).join('\n')}

## Education

${site.education.map((e) => `- ${e.level}: ${e.title}, ${e.org}`).join('\n')}

## Awards

${site.awards.map((a) => `- ${a.title} (${a.year}), ${a.org}`).join('\n')}

## Skills

${site.toolbox.map((g) => `- ${g.group}: ${g.items.join(', ')}`).join('\n')}

## Work

${works.map((w) => {
  const d = w.data;
  const cats = d.categories.map((c) => CATEGORIES[c as Category].label).join(', ');
  const meta = [String(d.date.getFullYear()), cats, d.tags.join(', ')].filter(Boolean).join(' · ');
  return `- [${d.title}](${abs(`work/${w.id}/`)}): ${d.summary} (${meta})${d.github ? ` Source: ${d.github}` : ''} Full text: ${abs(`work/${w.id}.md`)}`;
}).join('\n')}

## Optional

- [Full text of every project](${abs('llms-full.txt')})
- [Sitemap](${abs('sitemap.xml')})
`;
}
