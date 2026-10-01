// Locates (or downloads) the Slang compiler and compiles a .slang file to
// WGSL (WebGPU) and GLSL ES 3.00 (WebGL2).
//
// Lookup order for slangc:
//   1. $SLANGC
//   2. .slang/<version>/bin/slangc   (cached download, gitignored)
//   3. slangc on PATH
//   4. $VULKAN_SDK/bin/slangc
//   5. download the pinned release from GitHub into .slang/<version>/
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

export const SLANG_VERSION = '2026.18.2';
const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const CACHE = join(ROOT, '.slang', SLANG_VERSION);
const exe = process.platform === 'win32' ? 'slangc.exe' : 'slangc';

function works(bin) {
  try { return spawnSync(bin, ['-v'], { encoding: 'utf8' }).status === 0; } catch { return false; }
}

function assetName() {
  const arch = process.arch === 'arm64' ? 'aarch64' : 'x86_64';
  if (process.platform === 'win32') return `slang-${SLANG_VERSION}-windows-${arch}.zip`;
  if (process.platform === 'darwin') return `slang-${SLANG_VERSION}-macos-${arch}.tar.gz`;
  // glibc-2.27 build runs on older distros too (GitHub runners, Arch, …)
  return `slang-${SLANG_VERSION}-linux-${arch}${arch === 'x86_64' ? '-glibc-2.27' : ''}.tar.gz`;
}

async function download() {
  const name = assetName();
  const url = `https://github.com/shader-slang/slang/releases/download/v${SLANG_VERSION}/${name}`;
  console.log(`[slang] downloading ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`[slang] download failed: ${res.status} ${url}`);
  mkdirSync(CACHE, { recursive: true });
  const archive = join(CACHE, name);
  writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
  execFileSync('tar', ['-xf', archive, '-C', CACHE], { stdio: 'inherit' }); // bsdtar on Windows handles .zip
  rmSync(archive);
}

let pending;
export function findSlangc() {
  // Shaders compile in parallel; share one lookup/download.
  return (pending ??= locate());
}
async function locate() {
  const candidates = [
    process.env.SLANGC,
    join(CACHE, 'bin', exe),
    exe,
    process.env.VULKAN_SDK && join(process.env.VULKAN_SDK, 'bin', exe),
  ].filter(Boolean);
  for (const c of candidates) if (works(c)) return c;
  await download();
  const bin = join(CACHE, 'bin', exe);
  if (!works(bin)) throw new Error('[slang] slangc not usable after download');
  return bin;
}

function run(slangc, args) {
  const r = spawnSync(slangc, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`[slang] slangc ${args.join(' ')}\n${r.stderr || r.stdout}`);
  return r.stdout;
}

/**
 * Slang has no GLSL ES target, so we take its GLSL 450 output and lower it to
 * GLSL ES 3.00: our shaders only use uniform blocks, gl_FragCoord and the vertex
 * index, which map 1:1.
 */
export function toGLSLES(src) {
  return src
    .replace(/^#version .*$/m, '#version 300 es\nprecision highp float;\nprecision highp int;')
    .replace(/^#extension .*$/gm, '')
    .replace(/^#line .*$/gm, '')
    .replace(/^layout\(row_major\) (uniform|buffer);$/gm, '')
    .replace(/layout\(binding = \d+\)\s*/g, '')
    .replace(/layout\(set = \d+, binding = \d+\)\s*/g, '')
    .replace(/gl_VertexIndex\s*-\s*gl_BaseVertex/g, 'gl_VertexID')
    .replace(/gl_VertexIndex/g, 'gl_VertexID')
    .replace(/\n{3,}/g, '\n\n');
}

/** Compiles `file` (with entry points vsMain / fsMain) for both backends. */
export async function compileSlang(file) {
  const slangc = await findSlangc();
  const inc = ['-I', dirname(file)];
  const base = [...inc];
  const wgsl = run(slangc, [file, ...base, '-target', 'wgsl', '-entry', 'vsMain', '-entry', 'fsMain', '-o', '-']);
  const vert = toGLSLES(run(slangc, [file, ...base, '-target', 'glsl', '-entry', 'vsMain', '-stage', 'vertex', '-o', '-']));
  const frag = toGLSLES(run(slangc, [file, ...base, '-target', 'glsl', '-entry', 'fsMain', '-stage', 'fragment', '-o', '-']));
  // Resource bindings as declared in the WGSL, so the host can build bind groups
  // without hard-coding Slang's numbering (e.g. Sampler2D → texture + sampler).
  const bindings = [...wgsl.matchAll(/@binding\((\d+)\) @group\(0\) var(<uniform>)? \w+ : ([\w<>]+)/g)].map((m) => ({
    binding: Number(m[1]),
    kind: m[2] ? 'uniform' : m[3].startsWith('texture') ? 'texture' : 'sampler',
  }));
  return { wgsl, vert, frag, bindings };
}
