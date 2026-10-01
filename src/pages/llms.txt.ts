// /portfolio/llms.txt: a plain Markdown summary of the whole site for AI
// assistants and recruiter tools (https://llmstxt.org). Generated from
// site.json and the work posts, so it stays in sync with the CMS.
import type { APIRoute } from 'astro';
import { profileMarkdown } from '../lib/llms';

export const GET: APIRoute = async () =>
  new Response(await profileMarkdown(), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } });
