---
title: DirectX 11/12 Rasterizer
date: 2023-12-20
categories: [graphics]
tags: [DirectX 11, DirectX 12, SDL, RenderDoc]
summary: A rasterizer for learning the rendering pipeline and DirectX. Implements four swappable shading models, debugged in RenderDoc, later ported to DirectX 12.
cover: /portfolio/media/work/directx-rasterizer/screenshot-25.png
github: https://github.com/XanderBert/DX-11-12-Rasterizer
languages: [C++, HLSL]
---

This is a rasterizer built for the Graphics Programming course, aimed at learning the rendering pipeline and the basics of DirectX.

## Setup

SDL handles window creation, surface management, and input events. DirectX handles rendering to the window and shader compilation. RenderDoc is used for graphics debugging throughout.

## Shaders

I implemented four swappable shading models to compare how each one handles lighting and specular response:

- Cook-Torrance
- Blinn-Phong
- Phong
- Half Lambert

## Using the RenderDoc graphics debugger

![RenderDoc capture](/portfolio/media/work/directx-rasterizer/screenshot-25.png)

![RenderDoc capture](/portfolio/media/work/directx-rasterizer/screenshot-29.png)

## Adding DirectX 12 support

Later on I decided to learn DirectX 12 and the differences with DirectX 11. The biggest adjustment was DirectX 12's much more explicit model: managing root signatures, command lists, and synchronization by hand, compared to how much of that DirectX 11 handles implicitly for you. I now have the same visual result as with DirectX 11, and I can switch between the render backends with a preprocessor statement. This project was purely a way to learn the DirectX 12 API, so no proper abstraction or switching layer between render backends was built here.
