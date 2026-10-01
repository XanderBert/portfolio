#!/usr/bin/env node
// Copies every image/PDF that the content still loads from the old WordPress
// site into public/media/, and rewrites the links to point at the local copies.
//
//   npm run media:import            # download + rewrite
//   npm run media:import -- --dry   # only list what would happen
//
// Files go to public/media/work/<post-slug>/<file> (or public/media/about/ for
// site.json), and links become /portfolio/media/... — the same place the CMS
// uploads to. Safe to run again: already-local links are left alone.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_PREFIX = '/portfolio/media';
const DRY = process.argv.includes('--dry');

// Anything served by WordPress media (directly or through the i0.wp.com image CDN),
// plus images WordPress was proxying from itch.io.
const REMOTE = /https?:\/\/(?:i\d\.wp\.com\/)?(?:[\w.-]+\.(?:wpcomstaging|wordpress)\.com\/wp-content\/uploads|img\.itch\.zone)\/[^\s)"'<>]+/g;

/** Candidate URLs for the original file, best first. */
function sources(url) {
  const noQuery = url.replace(/\?.*$/, '');
  const direct = noQuery.replace(/^https?:\/\/i\d\.wp\.com\//, 'https://');
  return [...new Set([noQuery, url, direct])];
}

function fileNameFor(url) {
  const name = decodeURIComponent(basename(url.replace(/\?.*$/, '')));
  return name.replace(/[^\w.-]+/g, '-');
}

async function download(url, dest) {
  let lastError = '';
  for (const src of sources(url)) {
    try {
      const res = await fetch(src, { redirect: 'follow' });
      if (!res.ok) { lastError = `${res.status} ${src}`; continue; }
      const type = res.headers.get('content-type') ?? '';
      if (type.includes('text/html')) { lastError = `got HTML from ${src}`; continue; }
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
      return true;
    } catch (e) {
      lastError = `${e.message} (${src})`;
    }
  }
  console.warn(`  ✗ ${url}\n    ${lastError}`);
  return false;
}

/** Each content file and the media folder its files belong in. */
function contentFiles() {
  const workDir = join(ROOT, 'src/content/work');
  const files = readdirSync(workDir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ path: join(workDir, f), folder: `work/${basename(f, extname(f))}` }));
  files.push({ path: join(ROOT, 'src/data/site.json'), folder: 'about' });
  return files;
}

let downloaded = 0, failed = 0, rewritten = 0;
const done = new Map(); // remote url -> local public path (dedupe within a folder)

for (const { path, folder } of contentFiles()) {
  const text = readFileSync(path, 'utf8');
  const urls = [...new Set(text.match(REMOTE) ?? [])];
  if (!urls.length) continue;
  console.log(`${path.replace(ROOT + '/', '')}  (${urls.length})`);

  let out = text;
  for (const url of urls) {
    const key = `${folder}|${url}`;
    let local = done.get(key);
    if (!local) {
      const name = fileNameFor(url);
      const dest = join(ROOT, 'public/media', folder, name);
      local = `${PUBLIC_PREFIX}/${folder}/${name}`;
      if (DRY) {
        console.log(`  → ${local}`);
      } else if (existsSync(dest) || (await download(url, dest))) {
        if (!existsSync(dest)) continue;
        downloaded++;
        console.log(`  ✓ ${local}`);
      } else {
        failed++;
        continue; // keep the remote link so nothing breaks
      }
      done.set(key, local);
    }
    out = out.split(url).join(local);
    rewritten++;
  }
  if (!DRY && out !== text) writeFileSync(path, out);
}

console.log(DRY
  ? `\nDry run: ${rewritten} link(s) would be localised.`
  : `\n${downloaded} file(s) saved, ${rewritten} link(s) rewritten, ${failed} failed.`);
if (failed) process.exitCode = 1;
