---
title: Unreal Engine, Machine Learning and C++
date: 2024-05-03
categories: [other]
tags: [Unreal Engine, Learning Agents, C++]
summary: A C++ write-up for Unreal's Learning Agents plugin, reinforcement learning, imitation learning, deployment, and combining networks with behavior trees.
cover: ""
github: https://github.com/XanderBert/Unreal-Engine-Learning-Agents-Learning-Environment
languages: [C++]
---

Unreal Engine released a plugin called Learning Agents. It's still in beta, and there aren't many resources on it yet. Unreal Engine did release a [Basic Introduction Tutorial](https://dev.epicgames.com/community/learning/tutorials/qj2O/unreal-engine-learning-to-drive).

So I learned it, dug into the underlying code, and [made my own write-up](https://github.com/XanderBert/Unreal-Engine-Learning-Agents-Learning-Environment) so people can properly use it.

This project rebuilds the same setup in C++ and then expands upon it. In the write-up I explain how to set up:

- Basic reinforcement learning with C++
- Imitation learning
  - Recording
  - Imitation training
- Deploying the recorded network
- Combining the neural networks with a behavior tree to get the best of both worlds

I've learned a lot about machine learning and AI in games with this project.
