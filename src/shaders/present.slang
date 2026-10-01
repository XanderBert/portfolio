// present.slang: upscale + anti-aliasing, run at full canvas resolution.
//
// The scene shaders are expensive (a raymarch plus volumetric fog per pixel),
// so they render into an offscreen texture at reduced resolution. This pass
// brings that image up to screen size:
//
//   * Edge pixels, where the low-res image has strong local contrast, are
//                    blended along the edge direction (FXAA-style), which
//                    hides stair-steps.
//   * Everything else gets a sharp bicubic (Catmull-Rom) upscale plus a light,
//                    halo-free sharpen.
//   * Film grain is added last, at screen resolution, so it isn't magnified.

import common;

struct PresentParams
{
    float4 res;  // xy = source (scene) resolution, zw = destination (canvas) resolution
    float4 misc; // x = time, y = flipY, z = debug view, w = split-line position (0..1)
};

[[vk::binding(0, 0)]]
ConstantBuffer<PresentParams> P;

[[vk::binding(1, 0)]]
Sampler2D scene;

static const int kViewFinal    = 0; // the normal image
static const int kViewEdges    = 1; // edge-detection mask
static const int kViewRaw      = 2; // the low-res render, nearest-neighbour
static const int kViewSplit    = 3; // raw left of the split line, final right of it
static const int kViewBilinear = 4; // plain bilinear, no grain (scene is showing a debug buffer)

// Edge detection: a pixel counts as an edge when the luma range in its
// neighbourhood exceeds max(kEdgeMinContrast, kEdgeRelContrast * brightest).
static const float kEdgeMinContrast = 0.05;
static const float kEdgeRelContrast = 0.18;
static const float kEdgeMaxSpan     = 4.0;  // max blend distance along an edge, in source pixels

float luma(float3 c)
{
    return dot(c, float3(0.299, 0.587, 0.114));
}

// Sample the scene texture. uv is in GL convention (origin bottom-left) and is
// flipped here for WebGPU, whose textures start at the top.
float3 tap(float2 uv)
{
    float v = (P.misc.y > 0.5) ? 1.0 - uv.y : uv.y;
    return scene.SampleLevel(float2(uv.x, v), 0.0).rgb;
}

// Nearest-neighbour sample: exactly what the low-res render contains.
float3 tapNearest(float2 uv)
{
    float2 size = P.res.xy;
    return tap((floor(uv * size) + 0.5) / size);
}

// Catmull-Rom bicubic filter in 9 bilinear taps instead of 16 point taps: the
// two middle weights of each axis are merged into one tap placed between them.
float3 tapBicubic(float2 uv)
{
    float2 size      = P.res.xy;
    float2 samplePos = uv * size;
    float2 center    = floor(samplePos - 0.5) + 0.5; // texel center just below/left of the sample
    float2 f         = samplePos - center;           // 0..1 position between texels

    // Catmull-Rom weights for the four texels at offsets -1, 0, +1, +2.
    float2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
    float2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
    float2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
    float2 w3 = f * f * (-0.5 + 0.5 * f);

    // Merge w1 and w2 into one bilinear tap.
    float2 w12 = w1 + w2;
    float2 uv0  = (center - 1.0) / size;
    float2 uv12 = (center + w2 / w12) / size;
    float2 uv3  = (center + 2.0) / size;

    float3 c = float3(0.0);
    c += tap(float2(uv0.x,  uv0.y))  * w0.x  * w0.y;
    c += tap(float2(uv12.x, uv0.y))  * w12.x * w0.y;
    c += tap(float2(uv3.x,  uv0.y))  * w3.x  * w0.y;
    c += tap(float2(uv0.x,  uv12.y)) * w0.x  * w12.y;
    c += tap(float2(uv12.x, uv12.y)) * w12.x * w12.y;
    c += tap(float2(uv3.x,  uv12.y)) * w3.x  * w12.y;
    c += tap(float2(uv0.x,  uv3.y))  * w0.x  * w3.y;
    c += tap(float2(uv12.x, uv3.y))  * w12.x * w3.y;
    c += tap(float2(uv3.x,  uv3.y))  * w3.x  * w3.y;

    // Anti-ringing: Catmull-Rom's negative lobes overshoot at hard edges and draw
    // dark or bright halos. Clamp to the 2×2 texels the sample sits between.
    float2 base = center / size;
    float2 texel = 1.0 / size;
    float3 a = tap(base);
    float3 b = tap(base + float2(texel.x, 0.0));
    float3 d = tap(base + float2(0.0, texel.y));
    float3 e = tap(base + texel);
    return clamp(c, min(min(a, b), min(d, e)), max(max(a, b), max(d, e)));
}

// FXAA-style edge blend: estimate the edge direction from the diagonal luma
// gradient and average a few taps along it (never across it).
float3 blendAlongEdge(float2 uv, float2 texel, float lNW, float lNE, float lSW, float lSE, float lMin, float lMax)
{
    float2 dir = float2(-((lNW + lNE) - (lSW + lSE)),
                          (lNW + lSW) - (lNE + lSE));

    // Normalise so the shorter axis is ~1 texel, then cap the span.
    float dirReduce = max((lNW + lNE + lSW + lSE) * (0.25 / 8.0), 1.0 / 128.0);
    float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
    dir = clamp(dir * rcpDirMin, float2(-kEdgeMaxSpan), float2(kEdgeMaxSpan)) * texel;

    // Two-tap (narrow) and four-tap (wide) averages along the edge.
    float3 narrow = 0.5 * (tap(uv + dir * (1.0 / 3.0 - 0.5)) + tap(uv + dir * (2.0 / 3.0 - 0.5)));
    float3 wide   = narrow * 0.5 + 0.25 * (tap(uv - dir * 0.5) + tap(uv + dir * 0.5));

    // If the wide average left the local luma range it crossed another edge, so fall back.
    float lWide = luma(wide);
    return (lWide < lMin || lWide > lMax) ? narrow : wide;
}

// Unsharp mask against the 4-neighbour average, clamped so it can't create
// halos. Strength scales with the upscale factor, and it is off near native resolution.
float3 sharpen(float3 color, float2 uv, float2 texel, float upscale)
{
    if (upscale <= 1.15)
        return color;

    float3 neighbours = 0.25 * (tap(uv + float2(texel.x, 0.0)) + tap(uv - float2(texel.x, 0.0)) +
                                tap(uv + float2(0.0, texel.y)) + tap(uv - float2(0.0, texel.y)));
    float amount = saturate((upscale - 1.0) * 0.6);
    float3 sharp = color + amount * (color - neighbours);
    return clamp(sharp, min(color, neighbours) * 0.9, max(color, neighbours) * 1.1);
}

[shader("vertex")]
float4 vsMain(uint vertexId : SV_VertexID) : SV_Position
{
    return fullscreenTriangle(vertexId);
}

[shader("fragment")]
float4 fsMain(float4 svPosition : SV_Position) : SV_Target
{
    float2 dstRes    = P.res.zw;
    float2 fragCoord = fragCoordGL(svPosition, dstRes, P.misc.y);
    float2 uv        = fragCoord / dstRes;
    float2 texel     = 1.0 / P.res.xy;     // one *source* pixel, in uv units
    int    view      = int(P.misc.z + 0.5);

    // ---- Views that bypass the anti-aliasing ----------------------------------
    if (view == kViewRaw)
        return float4(tapNearest(uv), 1.0);
    if (view == kViewBilinear)
        return float4(tap(uv), 1.0);
    if (view == kViewSplit)
    {
        float split = P.misc.w;
        if (abs(uv.x - split) < 1.5 / dstRes.x) return float4(1.0, 1.0, 1.0, 1.0); // the divider line
        if (uv.x < split) return float4(tapNearest(uv), 1.0);
        // right of the line: fall through to the normal path
    }

    // ---- Edge detection (in the low-res image) --------------------------------
    float3 center = tap(uv);
    float lM  = luma(center);
    float lNW = luma(tap(uv + float2(-1.0,  1.0) * texel));
    float lNE = luma(tap(uv + float2( 1.0,  1.0) * texel));
    float lSW = luma(tap(uv + float2(-1.0, -1.0) * texel));
    float lSE = luma(tap(uv + float2( 1.0, -1.0) * texel));
    float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
    float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
    float contrast  = lMax - lMin;
    float threshold = max(kEdgeMinContrast, lMax * kEdgeRelContrast);
    bool  isEdge    = contrast > threshold;

    if (view == kViewEdges)
    {
        // Dimmed greyscale image, edge pixels coloured red → yellow by contrast.
        float3 grey = float3(lM * 0.35);
        float3 heat = lerp(float3(1.0, 0.25, 0.35), float3(1.0, 0.9, 0.3), saturate((contrast - threshold) / 0.25));
        return float4(isEdge ? heat : grey, 1.0);
    }

    // ---- Final image ----------------------------------------------------------
    float3 color;
    if (isEdge)
        color = blendAlongEdge(uv, texel, lNW, lNE, lSW, lSE, lMin, lMax);
    else
        color = sharpen(tapBicubic(uv), uv, texel, dstRes.y / P.res.y);

    color += filmGrain(fragCoord, P.misc.x);
    return float4(color, 1.0);
}
