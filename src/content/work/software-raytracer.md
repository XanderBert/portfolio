---
title: Software Raytracer
date: 2024-05-03
categories: [graphics]
tags: [C++, BVH, Multithreaded]
summary: A multithreaded CPU raytracer, pixels rendered in parallel with std::execution, accelerated with a per-triangle bounding volume hierarchy, Cook-Torrance materials.
cover: /portfolio/media/work/software-raytracer/image.png
github: ""
---

For the Graphics Programming I course, I built a simple multithreaded software raytracer.

## Multithreading

The multithreading is fairly straightforward and simple. I have a function called `RenderPixel()`. That function gets called in parallel using `std::execution`.

```cpp
std::for_each(std::execution::par, m_PixelIndices.begin(), m_PixelIndices.end(), [&](const glm::vec2& rayLocation)
{
    RenderPixel(pScene, rayLocation);
});
```

## Bounding volume hierarchy

Another significant optimization was implementing Bounding Volume Hierarchies (BVH).

First we calculate bounding box volumes, per triangle rather than per mesh. I create a node for each triangle, and then the tree gets subdivided.

When we start tracing rays, we can do simple and fast AABB tests. When we get a hit, we go deeper into the tree, and we keep doing this until we reach a leaf node (the end of the tree). At that point we know our triangle is somewhere in that box.

This way, the number of intersection checks we actually need to do for our rays is reduced by a huge amount.

## Materials

A few types of materials are supported in this raytracer:

- Solid coloring
- Lambert
- Lambert Phong
- Cook-Torrance

For the Cook-Torrance BRDF implementation we work with:

- Fresnel-Schlick
- Normal-GGX
- Smith

## .OBJ loading

It's capable of loading .obj files and showing them at runtime.

![Raytraced .obj](/portfolio/media/work/software-raytracer/image.png)
