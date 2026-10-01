# Xander Berten — portfolio

Live at **https://xanderbert.github.io/portfolio/**

Static site built with [Astro](https://astro.build). The 3D scenes are full-screen
shaders written in **Slang** (`src/shaders/`) and compiled at build time to **WGSL** for
WebGPU and **GLSL ES 3.00** for the WebGL2 fallback — no three.js. Pages scroll natively;
on Home and Work the stage is pinned and scroll drives the hero → work transition and the
horizontal card carousel.

```
npm install
npm run dev        # http://localhost:4321/portfolio/
npm run build      # outputs dist/
```

## Adding and editing work (the "backend")

Every project is one Markdown file in `src/content/work/`, like a WordPress post.
The file name is the URL: `vulkan-shader-editor.md` → `/portfolio/work/vulkan-shader-editor/`.

```md
---
title: Realtime Vulkan Shader Editor
date: 2024-05-03
categories: [graphics, tools]        # graphics | tools | games | awards | other
tags: [Vulkan 1.3, Hot reload]       # first three show on the card
summary: One or two sentences for the carousel and the post header.
cover: /portfolio/media/cover.png    # or any image URL
github: https://github.com/XanderBert/VulkanPlayground   # optional → repo card + source link
languages: [C++, GLSL]               # optional, shown on the repo card
links:                               # optional buttons under the title
  - { label: Play on itch.io, url: "https://…" }
facts:                               # optional row under the header
  - { label: API, value: Vulkan }
featured: true                       # up to 3 appear in the last chapter of Home
draft: false                         # true = hidden
---

Markdown body. Headings become the "On this page" menu.
Paste a YouTube link on its own line to embed it:

https://www.youtube.com/watch?v=iNZrSuBnJno
```

About page text, experience, awards, toolbox and contact links live in `src/data/site.json`.

### Editing in the browser — Sveltia CMS

Go to **/portfolio/admin/**. It is a WordPress-like editor for the files above
(forms for every field, image uploads to `public/media`, a Markdown editor). Saving
commits to this repo and the GitHub Action redeploys the site in about a minute.

- **Sign in with token:** create a fine-grained GitHub token for this repo with
  *Contents: Read and write*, then paste it on the admin login screen.
- **Local, no token:** run `npm run dev`, open `http://localhost:4321/portfolio/admin/`
  in Chrome/Edge and choose *Work with Local Repository*, then commit as usual.

The CMS is configured in `public/admin/config.yml` (it assumes the repo is `XanderBert/portfolio`).

### Adding Research later

1. Copy the `work` collection in `src/content.config.ts` as `research` pointing at `src/content/research/`.
2. Copy `src/pages/work/` to `src/pages/research/` and swap the collection name.
3. Add a link in `src/components/Nav.astro` and a `research` collection in `public/admin/config.yml`.

## SEO, AI assistants and visitor stats

Everything below is generated at build time from `src/data/site.json` and the
work posts, so editing content in the CMS keeps it current.

- **`/portfolio/llms.txt`**: a Markdown profile (contact, experience, skills,
  every project with a one-line summary) for AI assistants and recruiter tools,
  following https://llmstxt.org. **`/portfolio/llms-full.txt`** adds the full text
  of every post, and each post is also available as Markdown at `/portfolio/work/<slug>.md`.
- **Structured data**: every page carries schema.org JSON-LD (`src/lib/seo.ts`):
  a `Person` with skills, education, employer and awards, plus `ProfilePage`
  (About), `CollectionPage` (Work) and one `CreativeWork`/`SoftwareSourceCode`
  per post with breadcrumbs.
- **Link previews**: Open Graph and Twitter tags on every page. Posts use their
  cover image, other pages use `public/og.png` (1200×630).
- **`/portfolio/sitemap.xml`**: all public pages plus cover images.
  The CMS (`/admin/`) is excluded and marked `noindex`.

One-time steps outside this repo:

1. **Google Search Console** (https://search.google.com/search-console): add a
   *URL prefix* property for `https://xanderbert.github.io/portfolio/`, verify it
   (the "HTML tag" method: paste the tag's `content` value into `Base.astro` as
   `<meta name="google-site-verification" content="…">`), then submit `sitemap.xml`.
   Do the same in Bing Webmaster Tools, which also feeds ChatGPT and Copilot search.
2. **robots.txt**: crawlers only read it at the domain root, which is the blog
   repo. It has none, so everything is allowed already. To advertise the
   sitemap, add a `robots.txt` to the blog repo containing
   `Sitemap: https://xanderbert.github.io/portfolio/sitemap.xml`.

### Visitor stats

Counting uses [GoatCounter](https://www.goatcounter.com): free, no cookies, so no
cookie banner is needed. Set the site code in the CMS under **About & contact →
Analytics** (empty = off). It only counts on the deployed site, not in `npm run dev`.

In the CMS, the **Visitor stats** button (bottom right) opens `/portfolio/admin/stats/`
with visitors per day, countries, pages and referrers. It asks once for a
GoatCounter API key with only "Read statistics" permission. The key is stored in
that browser only, never in the repo.

## Deploying

1. Create an empty GitHub repo named **portfolio** under XanderBert and push this folder to `main`.
2. In the repo: *Settings → Pages → Build and deployment → Source: GitHub Actions*.
3. Every push to `main` (including CMS saves) runs `.github/workflows/deploy.yml`.

Your existing `xanderbert.github.io` blog is untouched — this site lives under `/portfolio/`.

## Rendering notes

- `src/shaders/*.slang` — the only shader source. `common.slang` holds shared helpers
  (full-screen triangle, noise, Henyey–Greenstein, tonemap); `sss.slang` is the home scene,
  `shafts.slang` the Work background. Each has `vsMain` / `fsMain` and one constant buffer of
  float4s whose first element is `(resolution, time, flipY)`.
- `tools/vite-plugin-slang.mjs` — `import s from './x.slang'` gives `{ wgsl, vert, frag }`.
  It runs `slangc` during `npm run build` and recompiles on save in `npm run dev`.
- `tools/slangc.mjs` — finds `slangc` (`$SLANGC`, `.slang/` cache, `PATH`, `$VULKAN_SDK/bin`)
  or downloads the pinned release (`SLANG_VERSION`) into `.slang/`. Slang has no GLSL ES
  target, so its GLSL output is lowered to `#version 300 es` there (strip bindings/extensions,
  `gl_VertexIndex` → `gl_VertexID`).
- `src/gpu/renderer.ts` — WebGPU → WebGL2 fallback, uniform buffer upload, dynamic resolution
  that only backs off when frames are actually missed. Add `?gl` to force WebGL2.
- The Scene button on the home page switches material (jade / wax / marble), resolution
  (auto / full / half) and cursor-driven light; choices are remembered per browser.
- Scene → Debug view explains the pipeline, each with a plain-language caption:
  surface normals, subsurface thickness, fog-only, surface-only, raymarch cost (with the
  bounding-sphere early-out), raw low-res render, raw-vs-final split, and the AA edge mask.
  Scene views are `kDebug*` in `sss.slang`; upscaler views are `misc.z` in `present.slang`.

Images in the imported posts are still served from the old WordPress media library
(`i0.wp.com/…`). They keep working while that site exists; to own them, download them into
`public/media/` and update the paths (or re-upload through the CMS).
