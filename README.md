# Xander Berten — portfolio

Live at **https://xanderbert.github.io/portfolio/**

Static site built with [Astro](https://astro.build). The 3D scenes are full-screen
shaders written in **Slang** (`src/shaders/`) and compiled at build time to **WGSL** for
WebGPU and **GLSL ES 3.00** for the WebGL2 fallback, no three.js.

```
npm install
npm run dev        # http://localhost:4321/portfolio/
npm run build      # outputs dist/
```


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