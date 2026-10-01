---
title: Polarization Rendering with Stokes Vectors and Mueller Matrices
date: 2026-04-16
categories: [graphics]
tags: [Polarization, Light transport, Fresnel]
summary: A small C++ simulation of polarized light, Stokes vectors, Mueller matrices and the full Fresnel equations for dielectrics and metals, checked against nine reference cases.
cover: ""
github: https://github.com/XanderBert/PolarizationRenderer
languages: [C++, CMake]
facts:
  - { label: Topic, value: "Polarized light transport" }
  - { label: Model, value: "Stokes · Mueller · complex IOR" }
  - { label: Verified, value: "9 reference cases" }
---

Most renderers treat light as an intensity per color channel and ignore polarization. But reflection polarizes light, and that changes what you see: glare off water disappears through polarized sunglasses, and the color of a second reflection depends on how the first one polarized it. This project is a compact simulation of exactly that, written to understand the math before putting it into a renderer.

## Stokes vectors

Polarized light is described with a Stokes vector of four values, all measured as irradiance:

- **S0**, the total intensity.
- **S1**, horizontal minus vertical linear polarization.
- **S2**, +45° minus −45° linear polarization.
- **S3**, right minus left circular polarization.

From these, the code derives the degree of polarization, the polarization angle and the ellipticity angle. A physically valid vector always satisfies S0² ≥ S1² + S2² + S3², and every operation in the simulation asserts this, which catches sign and frame mistakes early.

## Mueller matrices

Anything that changes polarization is a 4×4 Mueller matrix that multiplies the Stokes vector. The simulation implements three:

- **Fresnel reflection** for a material with a complex index of refraction (n + ik), so it handles both dielectrics like glass and water and conductors like metals. It computes the reflectances and the phase shifts (retardance) for both polarization directions and builds the matrix from them.
- **Rotation** of the reference frame. Each reflection has its own plane of incidence, so between two reflections the Stokes vector has to be rotated into the next surface's frame.
- **An ideal linear polarizing filter** at a given angle.

## The simulated setup

Light, optionally passed through a filter, reflects off a first surface, gets rotated into the frame of a second surface and reflects again:

```cpp
StokesVector inputLight = input.lightSource;
if (input.hasFilter) inputLight = filter.Apply(inputLight);

const StokesVector afterM2       = M2 * inputLight;
const StokesVector afterRotation = MullerMatrix(input.rho) * afterM2; // into the next surface's frame
const StokesVector result        = M1 * afterRotation;
```

All parameters (both complex IORs, both incidence angles, the rotation between the planes, the filter angle and the incoming Stokes vector) can be entered interactively.

## Verification

Running with `--test` checks the result against nine reference cases. They cover reflections off water and glass at angles close to their Brewster angles, where the reflected light becomes almost fully polarized, so a polarizing filter at 90° blocks nearly all of it. They also cover two total internal reflections inside glass. With light polarized at 45°, the two phase shifts add up to a quarter wave and the output becomes circularly polarized, the classic Fresnel rhomb. The last cases reflect off two metals with complex IORs, where the phase shifts turn linear polarization elliptical.

## Build

The project uses CMake. Run the executable to enter values interactively, or with `--test` to run the checks.
