---
title: Software Rasterizer
date: 2024-05-03
categories: [graphics]
tags: [C++, Depth buffer, CPU]
summary: What a GPU does under the hood, my own depth buffer, vertex culling and texture mapping, with normal, diffuse, metal and specular maps.
cover: /portfolio/media/work/software-rasterizer/image-1.png
github: https://github.com/XanderBert/SoftwareRasterizer
languages: [C++]
---

https://www.youtube.com/watch?v=p92a2qxh7-o

For my Graphics Programming course, I built a software rasterizer. The nice thing about this project is that I really learned what a GPU does under the hood.

I had to write my own depth buffer, vertex culling algorithm, and texture mapping algorithm. This rasterizer supports normal maps, diffuse maps, metal maps, and specular maps.

I also wrote two different loop implementations: one for triangle strips and one for triangle lists.

![Software rasterizer](/portfolio/media/work/software-rasterizer/image-1.png)

Here you can see the depth buffer visualization, the normal map in use, and the different calculations for the other textures.

https://www.youtube.com/watch?v=pBbxpMxc5kk
