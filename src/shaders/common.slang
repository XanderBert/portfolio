// common.slang helpers shared by every full-screen shader on the site.
//
// Each .slang file in this folder is compiled at build time (tools/slangc.mjs)
// to WGSL for WebGPU and GLSL ES 3.00 for the WebGL2 fallback.

static const float PI = 3.14159265;

// ---------------------------------------------------------------------------
// Full-screen pass
// ---------------------------------------------------------------------------

// One triangle that covers the whole viewport,
float4 fullscreenTriangle(uint vertexId)
{
    float x = (vertexId == 1) ? 3.0 : -1.0;
    float y = (vertexId == 2) ? 3.0 : -1.0;
    return float4(x, y, 0.0, 1.0);
}

// Pixel position with the origin at the bottom-left, on both backends.
// WebGPU's framebuffer origin is top-left and GL's is bottom-left
// The host sets flipY = 1 on WebGPU so every shader can work in the GL convention.
float2 fragCoordGL(float4 svPosition, float2 resolution, float flipY)
{
    float y = (flipY > 0.5) ? resolution.y - svPosition.y : svPosition.y;
    return float2(svPosition.x, y);
}

// ---------------------------------------------------------------------------
// Math
// ---------------------------------------------------------------------------

// Rotate a 2D vector counter-clockwise by `angle` radians.
float2 rot2(float2 v, float angle)
{
    float c = cos(angle);
    float s = sin(angle);
    return float2(c * v.x - s * v.y, s * v.x + c * v.y);
}

// Polynomial smooth minimum: a min() whose corner is rounded over a width of k.
// Used to blend two SDF shapes into one surface.
float smin(float a, float b, float k)
{
    float h = saturate(0.5 + 0.5 * (b - a) / k);
    return lerp(b, a, h) - k * h * (1.0 - h);
}

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

float hash3(float3 q)
{
    float3 p = frac(q * 0.3183099 + 0.1) * 17.0;
    return frac(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// Value noise: hashes at the 8 corners of the lattice cell, blended with a
// smoothstep curve so the result has no visible grid seams.
float valueNoise(float3 x)
{
    float3 cell = floor(x);
    float3 f = frac(x);
    float3 u = f * f * (3.0 - 2.0 * f);

    float c000 = hash3(cell + float3(0, 0, 0));
    float c100 = hash3(cell + float3(1, 0, 0));
    float c010 = hash3(cell + float3(0, 1, 0));
    float c110 = hash3(cell + float3(1, 1, 0));
    float c001 = hash3(cell + float3(0, 0, 1));
    float c101 = hash3(cell + float3(1, 0, 1));
    float c011 = hash3(cell + float3(0, 1, 1));
    float c111 = hash3(cell + float3(1, 1, 1));

    float bottomZ0 = lerp(c000, c100, u.x);
    float topZ0    = lerp(c010, c110, u.x);
    float bottomZ1 = lerp(c001, c101, u.x);
    float topZ1    = lerp(c011, c111, u.x);
    return lerp(lerp(bottomZ0, topZ0, u.y), lerp(bottomZ1, topZ1, u.y), u.z);
}

// ---------------------------------------------------------------------------
// Light transport
// ---------------------------------------------------------------------------

// Henyey Greenstein phase function: how much light a medium scatters at an
// angle theta from its travel direction. g > 0 favours forward scattering.
float henyeyGreenstein(float cosTheta, float g)
{
    float g2 = g * g;
    return (1.0 - g2) / (4.0 * PI * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

// Exponential tonemap, gamma 2.2 and a soft vignette.
float3 finish(float3 color, float exposure, float2 fragCoord, float2 resolution, float vignetteAmount)
{
    color = 1.0 - exp(-color * exposure);
    color = pow(color, float3(1.0 / 2.2));

    float2 q = fragCoord / resolution;
    float vignette = pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), 0.22);
    return color * ((1.0 - vignetteAmount) + vignetteAmount * vignette);
}

// Per-pixel, per-frame noise of ±1.25%, so gradients don't band.
float3 filmGrain(float2 fragCoord, float time)
{
    float n = hash3(float3(fragCoord, frac(time * 7.0) * 91.0));
    return float3((n - 0.5) * 0.025);
}
