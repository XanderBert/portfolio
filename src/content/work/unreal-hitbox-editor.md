---
title: Unreal Engine Hitbox Editor
date: 2024-01-09
categories: [tools]
tags: [Unreal Engine, Editor modules, Custom asset]
summary: A custom asset type and viewport for editing hitboxes, built for the indie fighting game Mythic Champions and later ported to the Night Sky Engine framework.
cover: /portfolio/media/work/unreal-hitbox-editor/mythic.png
github: ""
---

In my free time I work on a cool indie game called Mythic Champions with a really skilled team. It's a fighting game with RPG elements in a fantasy world.

https://www.youtube.com/watch?v=IiP4-SdempA

## Custom asset and viewport

https://www.youtube.com/watch?v=adY3JeNoNqU

We can create a custom asset now!

### How is it set up?

We work with two editor modules:

- Runtime module: `FAssetEditorTemplate`
- Editor module: `FAssetEditorTemplateEditor`

What's the difference between the two?

The runtime module just holds our actual data, some sort of UObject with all the data we want it to hold.

The editor module has a factory for our UObject, and an `FSimpleAssetTypeActions`. Those `FSimpleAssetTypeActions` can hold our actual viewport and editor buttons.

When the asset is created and we double-click on it, our custom viewport opens up.

## Night Sky Engine

The creator of the [Night Sky Engine](https://github.com/WistfulHopes/NightSkyEngine) framework joined our development team, and the core of our game moved to that framework, meaning my plugin would need to be reworked.

This was fairly easy since I had already done all the groundwork. A few team members and I copied over the logic for custom viewports and added a few more tabs.

A few days later, we had a fully functional hitbox editor working in the Night Sky Framework.
