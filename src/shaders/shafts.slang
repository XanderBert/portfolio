// shafts.slang: background of the Work page.
//
// Light pours through a slatted window above the camera into a hazy room. For
// every pixel we march along the view ray and, at each sample, ask: "if I
// follow the light back up to the window plane, do I come out through a gap
// between two slats?" If so, that bit of air is lit and scatters light toward
// the camera. Scrolling the card carousel slides the slats and the camera.
import common;

struct Params
{
    float4 resTime; // xy = resolution, z = time, w = flipY
    float4 misc;    // x = carousel progress (0..1)
};

[[vk::binding(0, 0)]]
ConstantBuffer<Params> P;

static const int    kSamples      = 40;
static const float  kMarchLength  = 14.0;
static const float  kWindowHeight = 4.0;                       // y of the window plane
static const float3 kToLight      = float3(-0.55, 0.75, 0.35); // direction toward the sun (normalized below)
static const float3 kLightColor   = float3(1.0, 0.8, 0.6);
static const float3 kAmbientColor = float3(0.35, 0.85, 0.7);   // faint teal fill so shadows aren't pure black
static const float3 kBackground   = float3(0.008, 0.011, 0.013);

// 1 where the light ray through `p` passes between two slats, 0 where it is blocked.
float windowMask(float3 p, float3 toLight, float progress)
{
    // Follow the light direction up to the window plane.
    float3 onWindow = p + toLight * ((kWindowHeight - p.y) / toLight.y);

    // Repeating slats: ~17% of each period is open, with a short soft edge.
    float slat = frac(onWindow.x * 0.45 + onWindow.z * 0.12 + progress * 1.5);
    float open = smoothstep(0.0, 0.05, slat) * (1.0 - smoothstep(0.16, 0.22, slat));

    // The window itself has finite size.
    float insideZ = 1.0 - smoothstep(4.5, 7.0, abs(onWindow.z - 7.0));
    float insideX = 1.0 - smoothstep(6.0, 9.0, abs(onWindow.x));
    return open * insideZ * insideX;
}

// Dusty air: slowly drifting noise, thicker near the floor.
float mediumDensity(float3 p, float time)
{
    float density = 0.012 + 0.07 * valueNoise(p * 0.9 + float3(0.0, -time * 0.05, time * 0.07));
    float nearFloor = 1.0 - smoothstep(-2.5, 0.0, p.y);
    return density * (1.0 + 1.5 * nearFloor);
}

[shader("vertex")]
float4 vsMain(uint vertexId : SV_VertexID) : SV_Position
{
    return fullscreenTriangle(vertexId);
}

[shader("fragment")]
float4 fsMain(float4 svPosition : SV_Position) : SV_Target
{
    float2 resolution = P.resTime.xy;
    float time        = P.resTime.z;
    float progress    = P.misc.x;
    float2 fragCoord  = fragCoordGL(svPosition, resolution, P.resTime.w);
    float2 uv         = (fragCoord - 0.5 * resolution) / resolution.y;

    // Camera: slides sideways with the carousel, looks down +z.
    float3 rayOrigin = float3(progress * 1.6 - 0.8, 0.0, -1.0);
    float3 rayDir    = normalize(float3(uv, 1.4));
    float3 toLight   = normalize(kToLight);

    // The phase function only depends on the angle between view and light,
    // which is constant along a ray, so compute it once.
    float phase = henyeyGreenstein(dot(toLight, rayDir), 0.6);

    // Random start offset per pixel turns banding into fine noise.
    float jitter = hash3(float3(fragCoord, frac(time) * 37.0));

    float stepSize = kMarchLength / float(kSamples);
    float3 inScattered = float3(0.0);
    float transmittance = 1.0;

    for (int i = 0; i < kSamples; i++)
    {
        float3 p = rayOrigin + rayDir * (0.3 + (float(i) + jitter) * stepSize);
        float density = mediumDensity(p, time);
        float lit = windowMask(p, toLight, progress);

        float3 scatter = lit * kLightColor * phase * 16.0 + kAmbientColor * 0.012;
        inScattered += transmittance * density * scatter * stepSize;
        transmittance *= exp(-density * stepSize * 0.6);
    }

    float3 color = kBackground * transmittance + inScattered;
    return float4(finish(color, 0.7, fragCoord, resolution, 0.55), 1.0);
}
