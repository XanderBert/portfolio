---
title: EOS Renderer
date: 2026-09-13
categories: [graphics]
tags: [Vulkan, Slang, GPU-driven]
summary: A Vulkan rendering library built from scratch, bindless resources and buffer device addresses, GPU-driven SDSM cascaded shadows and inline ray-traced shadows.
cover: /portfolio/media/work/eos-renderer/Cascade.webp
github: https://github.com/XanderBert/EOS
languages: [C++, Slang, CMake]
featured: true
facts:
  - { label: API, value: "Vulkan · bindless · BDA" }
  - { label: Shaders, value: Slang }
  - { label: Tooling, value: "Tracy · Nsight · GitHub Actions" }
---

For a while now I've been working on my own renderer from scratch, called EOS. It's a Vulkan-based rendering library. I wanted a place where I could actually implement modern GPU-driven rendering techniques instead of just reading papers about them, so EOS became my playground for that.

It's structured as a library rather than a single application. There's an `examples/` folder with separate CMake projects that each link against EOS. 

## Architecture

Under the hood EOS leans heavily on bindless rendering and buffer device address (BDA). Instead of the classic descriptor-set-per-material setup, resources get indexed directly, which massively simplifies binding logic once you have it set up (getting there was its own adventure, more on that below).

Shaders are written in Slang rather than GLSL/HLSL, which has been great for sharing code between rasterization and ray tracing shaders. The whole pipeline is built to be GPU-driven, A visibility buffer is the direction I'm researching next, though it isn't implemented yet.

![Frame anatomy: SDSM cascades and ray-traced shadows feeding one lighting pass](/portfolio/media/eos-frame.svg)

## Example: Shadows: 
### CSM with GPU-driven SDSM

One of the bigger features so far is cascaded shadow maps, but done properly with a full GPU-driven Sample Distribution Shadow Maps (SDSM) pipeline. That means:

- A depth reduction compute shader that analyzes the depth buffer to figure out the actual scene depth range
- A cascade setup compute shader that fits the shadow cascades to that range instead of relying on fixed splits
- Single-pass rendering of all cascades using a geometry shader with `SV_RenderTargetArrayIndex`, so I don't need a separate draw call per cascade

This gets you shadow cascades that actually fit what's on screen instead of wasting resolution on empty space, which was a nice improvement once I got it working.

![Cascade debug view](/portfolio/media/work/eos-renderer/CascadeDebug.webp)

![Cascaded shadows](/portfolio/media/work/eos-renderer/Cascade.webp)

### Ray traced direct shadows

Alongside the rasterized shadow maps I also implemented ray traced direct shadows using RayQuery and TraceRayInline. It's nice being able to compare the two approaches side by side in the same renderer, rasterized cascades for the broad strokes and inline ray tracing where you want that extra bit of correctness.

![Ray traced shadows](/portfolio/media/work/eos-renderer/RayTracing.webp)

## Fighting Vulkan sync

A good chunk of the development time on EOS has gone into getting Vulkan's synchronization model just right, and honestly it's been one of the more satisfying parts of the project. Every issue solved taught me something new about how the GPU actually schedules and synchronizes work under the hood.

## Memory management

To keep the Vulkan backend manageable I built out a proper memory system: `Pool<T>` and `PoolMemoryResource<T>`

## Custom ImGui backend

For debugging and tooling I wrote a custom ImGui backend targeting Vulkan and Slang directly, rather than relying on the stock ImGui Vulkan backend. This made it much easier to integrate with the rest of EOS's bindless/BDA setup instead of fighting two different resource binding philosophies at once.

## Texture compression pipeline

I also built `eos-texc`, a texture compression pipeline built around KTX and Basis Universal. Having a proper offline compression step baked into the pipeline was a must-have rather than a nice-to-have.

## Tooling and CI

To keep EOS from silently rotting as I add features I set up:

- GitHub Actions CI so builds get checked automatically
- Tracy integration for GPU profiling, so I can actually see where frame time is going instead of guessing
- GLFW with dual Wayland/X11 backend support, mainly so I could keep using Nsight Graphics for debugging without backend headaches

## What's next

There's still plenty on the horizon for EOS. The visibility buffer is the big one. I've already written up a research summary on triangle visibility buffers and the plan is to actually implement it next. Long term this ties into my thesis work, which is looking at ReSTIR.

EOS is very much a living project, so expect more posts as new pieces land.