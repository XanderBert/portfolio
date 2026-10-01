// `import scene from '../shaders/sss.slang'` → { wgsl, vert, frag } strings,
// compiled by slangc at build time (and recompiled on change in `astro dev`).
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { compileSlang } from './slangc.mjs';

export default function slang() {
  return {
    name: 'slang',
    enforce: 'pre',
    async load(id) {
      const file = id.split('?')[0];
      if (!file.endsWith('.slang')) return null;
      // Rebuild when this file or any shared module next to it changes.
      for (const f of readdirSync(dirname(file))) if (f.endsWith('.slang')) this.addWatchFile(join(dirname(file), f));
      const out = await compileSlang(file);
      return `export default ${JSON.stringify(out)};`;
    },
    handleHotUpdate(ctx) {
      if (!ctx.file.endsWith('.slang')) return;
      // A shared module changed: reload every shader that may import it.
      const mods = [...ctx.server.moduleGraph.idToModuleMap.values()].filter((m) => m.file?.endsWith('.slang'));
      mods.forEach((m) => ctx.server.moduleGraph.invalidateModule(m));
      ctx.server.ws.send({ type: 'full-reload' });
      return [];
    },
  };
}
