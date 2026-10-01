---
title: Merging GTAO and a Fast SSAO Technique
date: 2025-01-16
categories: [graphics]
tags: [Bachelor's thesis, The Forge, Compute]
summary: Bachelor's thesis on screen-space ambient and directional occlusion, two SSAO techniques merged in compute shaders to get the best of both.
cover: /portfolio/media/work/gtao-fast-ssao/merged_visual-1.png
github: ""
featured: true
links:
  - { label: Read the paper (PDF), url: "/portfolio/media/work/gtao-fast-ssao/gradwork.pdf" }
---

For my Bachelor's thesis I studied Screen Space Ambient and Directional Occlusion. In the end I decided to merge two SSAO techniques and use compute shaders to get the best of both worlds.

## Framework

I decided to learn a framework that is being used in the industry for this research. It is called The Forge.

The Forge is a low-level, multi-platform rendering framework designed to serve as a robust rendering system for game engines. It supports a wide range of platforms, and has built-in support for timing rendering passes and shader code. It also exports a nice graph of all timings and render passes with each launch of your application. That's why I chose to learn this framework.

## Fast SSAO

The first technique I decided to use was a fast SSAO technique by Wojciech Sterna, described in GPU Zen.

![Fast SSAO](/portfolio/media/work/gtao-fast-ssao/fastssao_visual.png)

This technique took about 0.40 ms.

## Ground Truth Ambient Occlusion

This is my implementation of Ground Truth Ambient Occlusion, described in a [paper](https://www.activision.com/cdn/research/Practical_Real_Time_Strategies_for_Accurate_Indirect_Occlusion_NEW%20VERSION_COLOR.pdf) from Activision.

https://www.youtube.com/watch?v=_0AkMTZZV6s

This technique took about 1.6 ms.

## The merged technique

I combined the optimizations of the fast technique with the SSAO calculations of GTAO. In my opinion, the result is a genuinely good tradeoff between visuals and speed.

![Merged technique](/portfolio/media/work/gtao-fast-ssao/merged_visual-1.png)

This technique took about 0.54 ms.

## Paper

If you would like to read about this in more detail, I have written a paper going into it further: [Merging SSAO Techniques (PDF)](/portfolio/media/work/gtao-fast-ssao/gradwork.pdf).
