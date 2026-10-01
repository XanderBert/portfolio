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