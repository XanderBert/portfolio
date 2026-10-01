// @ts-check
import { defineConfig } from 'astro/config';
import remarkYoutube from './src/lib/remark-youtube.mjs';
import slang from './tools/vite-plugin-slang.mjs';

// Served from https://xanderbert.github.io/portfolio/ (a project repo named "portfolio").
// If you move to a custom domain or a user site, change `site` and set `base` to '/'.
export default defineConfig({
  site: 'https://xanderbert.github.io',
  base: '/portfolio',
  trailingSlash: 'ignore',
  vite: {
    // Shaders are written in Slang and compiled to WGSL + GLSL ES at build time.
    plugins: [slang()],
  },
  markdown: {
    remarkPlugins: [remarkYoutube],
    shikiConfig: { theme: 'github-dark-dimmed' },
  },
});
