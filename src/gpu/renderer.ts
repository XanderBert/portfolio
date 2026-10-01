// Tiny two-pass renderer: WebGPU first, WebGL2 fallback.
//
//   1. scene pass   — the page's Slang shader, rendered into an offscreen RGBA8
//                     target at a reduced resolution (the expensive part).
//   2. present pass — src/shaders/present.slang at full canvas resolution:
//                     bilinear upsample + edge-detected FXAA-style blending,
//                     plus film grain at display resolution.
//
// Shaders are written once in Slang; tools/vite-plugin-slang.mjs compiles each
// to WGSL (both entry points) and GLSL ES 3.00 at build time. Every scene shader
// reads one constant buffer of float4s whose element 0 is
// (resolution.x, resolution.y, time, flipY); flipY is filled in here.
import present from '../shaders/present.slang';

export type Backend = 'webgpu' | 'webgl2';

export interface ShaderSource {
  wgsl: string;
  vert: string;
  frag: string;
  bindings: { binding: number; kind: 'uniform' | 'texture' | 'sampler' }[];
}

/** debugView: 0 = final, 1 = AA edge mask, 2 = raw low-res (nearest), 3 = split raw | final at `split` (0..1). */
export interface DrawOptions { time: number; debugView: number; split: number }

export interface Renderer {
  backend: Backend;
  canvas: HTMLCanvasElement;
  /** Renders the scene at sceneW×sceneH, then upsamples + anti-aliases to the canvas size. */
  draw(u: Float32Array, sceneW: number, sceneH: number, opts: DrawOptions): void;
  destroy(): void;
}

function freshCanvas(old: HTMLCanvasElement): HTMLCanvasElement {
  // A canvas that has handed out a "webgpu" context can never give a WebGL one.
  const c = old.cloneNode(false) as HTMLCanvasElement;
  delete c.dataset.ctx;
  old.replaceWith(c);
  return c;
}

const presentParams = new Float32Array(8);

// ---------------------------------------------------------------- WebGPU ----

async function tryWebGPU(canvas: HTMLCanvasElement, src: ShaderSource, bytes: number): Promise<Renderer | null> {
  const gpu = (navigator as any).gpu;
  if (!gpu) return null;
  const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) return null;
  const device = await adapter.requestDevice();
  const ctx = canvas.getContext('webgpu') as any;
  if (!ctx) return null;
  canvas.dataset.ctx = 'webgpu';
  const canvasFormat = gpu.getPreferredCanvasFormat();
  ctx.configure({ device, format: canvasFormat, alphaMode: 'opaque' });

  const makePipeline = async (code: string, format: string) => {
    const module = device.createShaderModule({ code });
    const errors = (await module.getCompilationInfo()).messages.filter((m: any) => m.type === 'error');
    if (errors.length) throw new Error(errors.map((e: any) => `${e.lineNum}:${e.linePos} ${e.message}`).join('\n'));
    return device.createRenderPipelineAsync({
      layout: 'auto',
      vertex: { module, entryPoint: 'vsMain' },
      fragment: { module, entryPoint: 'fsMain', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    });
  };
  let scenePipe: any, presentPipe: any;
  try {
    [scenePipe, presentPipe] = await Promise.all([makePipeline(src.wgsl, 'rgba8unorm'), makePipeline(present.wgsl, canvasFormat)]);
  } catch (e) {
    console.warn('[gpu] WGSL errors', e);
    device.destroy();
    return null;
  }

  const UNIFORM = 0x40, COPY_DST = 0x08, TEXTURE_BINDING = 0x04, RENDER_ATTACHMENT = 0x10;
  const sceneUBO = device.createBuffer({ size: bytes, usage: UNIFORM | COPY_DST });
  const presentUBO = device.createBuffer({ size: presentParams.byteLength, usage: UNIFORM | COPY_DST });
  const sceneBG = device.createBindGroup({ layout: scenePipe.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: sceneUBO } }] });
  const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });

  let target: any = null, targetView: any = null, presentBG: any = null, tw = 0, th = 0;
  const ensureTarget = (w: number, h: number) => {
    if (w === tw && h === th) return;
    target?.destroy();
    target = device.createTexture({ size: [w, h], format: 'rgba8unorm', usage: RENDER_ATTACHMENT | TEXTURE_BINDING });
    targetView = target.createView();
    presentBG = device.createBindGroup({
      layout: presentPipe.getBindGroupLayout(0),
      entries: present.bindings.map((b) => ({
        binding: b.binding,
        resource: b.kind === 'uniform' ? { buffer: presentUBO } : b.kind === 'texture' ? targetView : sampler,
      })),
    });
    tw = w; th = h;
  };

  let lost = false;
  device.lost.then(() => { lost = true; });

  return {
    backend: 'webgpu',
    canvas,
    draw(u, w, h, opts) {
      if (lost) return;
      ensureTarget(w, h);
      u[3] = 1; // flipY: WebGPU framebuffer origin is top-left
      presentParams.set([w, h, canvas.width, canvas.height, opts.time, 1, opts.debugView, opts.split]);
      device.queue.writeBuffer(sceneUBO, 0, u);
      device.queue.writeBuffer(presentUBO, 0, presentParams);
      const enc = device.createCommandEncoder();
      const p1 = enc.beginRenderPass({ colorAttachments: [{ view: targetView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      p1.setPipeline(scenePipe); p1.setBindGroup(0, sceneBG); p1.draw(3); p1.end();
      const p2 = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }] });
      p2.setPipeline(presentPipe); p2.setBindGroup(0, presentBG); p2.draw(3); p2.end();
      device.queue.submit([enc.finish()]);
    },
    destroy() { device.destroy(); },
  };
}

// ---------------------------------------------------------------- WebGL2 ----

function tryWebGL2(canvas: HTMLCanvasElement, src: ShaderSource, bytes: number): Renderer | null {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'high-performance' });
  if (!gl) return null;

  const program = (vert: string, frag: string) => {
    const compile = (type: number, code: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, code);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn('[gpu] GLSL', gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vert));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn('[gpu] link', gl.getProgramInfoLog(p)); return null; }
    return p;
  };
  const sceneProg = program(src.vert, src.frag);
  const presentProg = program(present.vert, present.frag);
  if (!sceneProg || !presentProg) return null;

  // Slang emits each constant buffer as one std140 uniform block.
  const ubo = (prog: WebGLProgram, point: number, size: number) => {
    gl.uniformBlockBinding(prog, 0, point);
    const b = gl.createBuffer()!;
    gl.bindBuffer(gl.UNIFORM_BUFFER, b);
    gl.bufferData(gl.UNIFORM_BUFFER, size, gl.DYNAMIC_DRAW);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, point, b);
    return b;
  };
  const sceneUBO = ubo(sceneProg, 0, bytes);
  const presentUBO = ubo(presentProg, 1, presentParams.byteLength);

  // The present shader's Sampler2D → texture unit 0.
  gl.useProgram(presentProg);
  for (let i = 0, n = gl.getProgramParameter(presentProg, gl.ACTIVE_UNIFORMS); i < n; i++) {
    const info = gl.getActiveUniform(presentProg, i);
    if (info && info.type === gl.SAMPLER_2D) gl.uniform1i(gl.getUniformLocation(presentProg, info.name), 0);
  }

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fbo = gl.createFramebuffer();
  let tw = 0, th = 0;
  gl.bindVertexArray(gl.createVertexArray()); // no attributes: vertices come from gl_VertexID

  return {
    backend: 'webgl2',
    canvas,
    draw(u, w, h, opts) {
      if (w !== tw || h !== th) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        tw = w; th = h;
      }
      u[3] = 0; // flipY: GL origin is already bottom-left
      presentParams.set([w, h, canvas.width, canvas.height, opts.time, 0, opts.debugView, opts.split]);

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, w, h);
      gl.useProgram(sceneProg);
      gl.bindBuffer(gl.UNIFORM_BUFFER, sceneUBO);
      gl.bufferSubData(gl.UNIFORM_BUFFER, 0, u);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(presentProg);
      gl.bindBuffer(gl.UNIFORM_BUFFER, presentUBO);
      gl.bufferSubData(gl.UNIFORM_BUFFER, 0, presentParams);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy() { gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}

/** Add `?gl` to the URL to force the WebGL2 path (handy for comparing backends). */
export async function createRenderer(canvas: HTMLCanvasElement, src: ShaderSource, uniformFloats: number): Promise<Renderer | null> {
  const bytes = Math.ceil(uniformFloats / 4) * 16;
  const forceGL = new URLSearchParams(location.search).has('gl');
  if (!forceGL) {
    try {
      const r = await tryWebGPU(canvas, src, bytes);
      if (r) return r;
    } catch (e) {
      console.warn('[gpu] WebGPU init failed, falling back to WebGL2', e);
    }
    if (canvas.dataset.ctx === 'webgpu') canvas = freshCanvas(canvas);
  }
  return tryWebGL2(canvas, src, bytes);
}

/** 'auto' adapts to frame time; a number pins the scene render scale (1 = display resolution). */
export type Quality = 'auto' | number;

/**
 * Drives a renderer. The canvas always matches its CSS box at device resolution
 * (capped); only the scene pass is scaled. Pauses when off-screen or hidden.
 *
 * Auto quality: rAF is vsync-locked, so a healthy frame reads ~16.7 ms at 60 Hz
 * (~6.9 ms at 144 Hz). Resolution only drops when frames are clearly being
 * missed, and climbs back whenever we are keeping up.
 */
export function runLoop(
  r: Renderer,
  frame: (t: number, dt: number, sceneW: number, sceneH: number) => Float32Array,
  opts: {
    quality?: () => Quality;
    debug?: () => { view: number; split: number };
    minScale?: number;
    onStats?: (ms: number, sceneW: number, sceneH: number, scale: number) => void;
  } = {},
) {
  const { quality = () => 'auto', debug = () => ({ view: 0, split: 0.5 }), minScale = 0.5, onStats } = opts;
  const dpr = () => Math.min(devicePixelRatio || 1, 2);
  let autoScale = 0.6;
  let visible = true;
  let raf = 0;
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; });
  io.observe(r.canvas);
  const t0 = performance.now();
  let last = t0, acc = 0, n = 0, worst = 0;

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const c = r.canvas;
    const dtMs = now - last;
    last = now;
    if (!visible || document.hidden) { acc = 0; n = 0; worst = 0; return; }
    const cw = Math.max(2, Math.round(c.clientWidth * dpr()));
    const ch = Math.max(2, Math.round(c.clientHeight * dpr()));
    if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    const q = quality();
    const scale = q === 'auto' ? autoScale : q;
    const sw = Math.max(2, Math.round(cw * scale)), sh = Math.max(2, Math.round(ch * scale));
    const t = (now - t0) / 1000;
    const d = debug();
    r.draw(frame(t, Math.min(0.1, dtMs / 1000), sw, sh), sw, sh, { time: t, debugView: d.view, split: d.split });
    if (dtMs < 250) { acc += dtMs; n++; worst = Math.max(worst, dtMs); }
    if (acc > 700 && n > 0) {
      const ms = acc / n;
      if (q === 'auto') {
        if (ms > 21) autoScale = Math.max(minScale, autoScale * 0.88);             // missing vsync: back off
        else if (ms < 18 && worst < 26) autoScale = Math.min(1, autoScale * 1.05); // keeping up: sharpen
      }
      onStats?.(ms, sw, sh, scale);
      acc = 0; n = 0; worst = 0;
    }
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(raf); io.disconnect(); };
}
