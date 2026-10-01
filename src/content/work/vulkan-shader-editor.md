---
title: Realtime Vulkan Shader Editor
date: 2024-05-03
categories: [graphics, tools]
tags: [Vulkan 1.3, Hot reload, GLSL]
summary: A shader editor with a Vulkan 1.3 backend, hot-reloading shaders, runtime-editable materials, compute post-FX and glTF / OBJ import.
cover: /portfolio/media/work/vulkan-shader-editor/realtimevulkan-1.gif
github: https://github.com/XanderBert/VulkanPlayground
languages: [C++, GLSL]
featured: true
---

## What can it do?

- Hot reloading shaders
- Compute calculations
- Runtime-expandable and runtime-editable dynamic uniform buffers / texture samplers
- Dynamic rendering (fully available in the Vulkan 1.3 API)
- Runtime creation of shaders and materials
- Import .OBJ and .GLTF files at runtime
- Gizmos to edit transform, scale and rotation
- Edit shaders in a custom IDE
- Change textures

https://www.youtube.com/watch?v=iNZrSuBnJno

## Shading model

![Reflections](/portfolio/media/work/vulkan-shader-editor/reflections.gif)

https://www.youtube.com/watch?v=XRfIWvJTb-o

- Basic PBR
- Simple cubemapping
- Simple reflection on the model from the cubemap
- Tone mapping
- Gamma correction

## Hot reloading shaders

So how does it work? First of all, I have a file watcher running on a separate thread. Operating systems send events when a file gets changed or added, so I listen for those.

On that event, the [Shaderc](https://github.com/google/shaderc) compiler gets fired, which compiles the shader, and on success all the pipelines that use this shader get reloaded with the newly compiled shader.

![Helmet](/portfolio/media/work/vulkan-shader-editor/helmet.png)

## Compute shaders

I've started work on a system for compute post-FX in my editor. It already supports input and output images.

![Compute post-FX](/portfolio/media/work/vulkan-shader-editor/computefx.gif)

## Why use Vulkan 1.3 dynamic rendering?

Mainly because it simplifies a lot around passes and subpasses, resulting in much cleaner and more readable code with the potential to be more efficient on more modern GPUs.

## Why did I make it?

For my Graphics Programming 2 course, we learned the basics of the Vulkan API. For the final project, we had almost total freedom in what to make.

I learned to program shaders a few years ago with Nvidia FX Composer.

![Nvidia FX Composer](/portfolio/media/work/vulkan-shader-editor/image-2.png)

I always wanted a more modern shader editor to learn GLSL, but every existing solution I found didn't really fulfill my needs. So I decided to make my own, with Vulkan as the backend!

This project is still a work in progress.
