// sss.slang: the home page scene.
//
// A jade/wax/marble object (a wobbling sphere with a ring around it) defined as
// a signed distance field, lit by a spotlight shining through hazy air.
//
// Per pixel:
//   1. Bounding sphere:  rays that can't reach the object skip the raymarch.
//   2. Sphere tracing:   find the surface, with analytic edge anti-aliasing.
//   3. Surface shading:  subsurface transmission (how much light makes it
//                          *through* the material) plus Fresnel reflection.
//   4. Participating media: single scattering of the spotlight in the fog,
//                          with the object casting a volumetric shadow.
//   5. Tonemap.
import common;

struct Params
{
    float4 resTime;    // xy = resolution, z = time, w = flipY
    float4 offDistYaw; // xy = screen offset of the subject, z = camera distance, w = camera yaw
    float4 lightFog;   // xyz = light position, w = fog density multiplier
    float4 absGlow;    // xyz = absorption coefficient σa per unit length (RGB), w = exposure
    float4 tint;       // xyz = surface albedo for shallow scattering, w = debug view (kDebug*)
};

[[vk::binding(0, 0)]]
ConstantBuffer<Params> P;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

static const float  kFocalLength    = 1.7;                     // camera zoom: larger = narrower field of view
static const float  kCameraHeight   = 0.35;
static const int    kMaxSteps       = 128;                     // sphere-tracing iteration cap
static const float  kBoundRadius    = 1.6;                     // the whole object fits inside this sphere
static const float  kIOR            = 1.45;                    // index of refraction (jade ≈ 1.6, wax ≈ 1.44)
static const float3 kLightColor     = float3(1.0, 0.8, 0.6);   // warm tungsten
static const float  kLightPower     = 18.0;                    // intensity at distance 1 (inverse-square falloff)
static const float3 kBackground     = float3(0.010, 0.014, 0.016);
static const int    kFogSamples     = 28;
static const float  kFogPhaseG      = 0.55;                    // forward-scattering haze

// Debug views, selected by P.tint.w (see the Scene panel on the home page).
static const int kDebugSteps     = 1;
static const int kDebugNormals   = 2;
static const int kDebugThickness = 3;
static const int kDebugFogOnly   = 4;
static const int kDebugNoFog     = 5;

// ---------------------------------------------------------------------------
// The shape
// ---------------------------------------------------------------------------

// Signed distance from p to the object: negative inside, positive outside.
float sceneSDF(float3 p)
{
    float time = P.resTime.z;

    // Slow spin plus a fixed tilt.
    p.xz = rot2(p.xz, time * 0.12);
    p.xy = rot2(p.xy, 0.3);

    // Core: a sphere whose radius wobbles with a little animated sine noise.
    float wobble = 0.07 * sin(3.1 * p.x + time * 0.6)
                        * sin(2.7 * p.y + 1.3)
                        * sin(3.3 * p.z - time * 0.4);
    float core = length(p) - 0.9 + wobble;

    // Ring: a torus (major radius 1.3, tube radius 0.16), tilted around x.
    float3 q = p;
    q.yz = rot2(q.yz, 1.1);
    float ring = length(float2(length(q.xz) - 1.3, q.y)) - 0.16;

    // Small blend radius on purpose: the ring sits ~0.24 away from the core, and
    // a blend wider than that stretches a paper-thin web of surface across the gap.
    return smin(core, ring, 0.08);
}

// Surface normal = gradient of the SDF, from 4 samples in a tetrahedron pattern.
float3 sceneNormal(float3 p)
{
    float2 e = float2(1.0, -1.0) * 0.0009;
    return normalize(e.xyy * sceneSDF(p + e.xyy) +
                     e.yyx * sceneSDF(p + e.yyx) +
                     e.yxy * sceneSDF(p + e.yxy) +
                     e.xxx * sceneSDF(p + e.xxx));
}

// ---------------------------------------------------------------------------
// Ray helpers
// ---------------------------------------------------------------------------

// Ray / sphere-at-origin intersection. Returns false on a miss, otherwise the
// entry and exit distances along the ray (entry clamped to 0 if we start inside).
bool raySphere(float3 origin, float3 dir, float radius, out float tEnter, out float tExit)
{
    float b = dot(origin, dir);
    float h = b * b - (dot(origin, origin) - radius * radius);
    tEnter = 0.0;
    tExit = 0.0;
    if (h <= 0.0) return false;
    h = sqrt(h);
    tEnter = max(0.0, -b - h);
    tExit = -b + h;
    return true;
}

// How far light travels inside the material, starting just below the surface
// at p and heading in direction d, until it exits again. Inside the object the
// SDF is negative, so -sceneSDF is the distance to the nearest exit.
float thickness(float3 p, float3 d)
{
    float t = 0.02;
    for (int i = 0; i < 28; i++)
    {
        float distToExit = -sceneSDF(p + d * t);
        if (distToExit < 0.002) break;     // reached the far side
        t += max(distToExit, 0.025);
        if (t > 4.0) break;
    }
    return t;
}

// Volumetric shadow for the fog: 0 if the segment from the light toward a fog
// sample (length maxT) passes through the object, else 1. The object is
// approximated by a sphere of radius ~1.14, which is plenty for soft haze.
float sphereShadow(float3 lightPos, float3 dir, float maxT)
{
    float b = dot(lightPos, dir);
    float h = b * b - (dot(lightPos, lightPos) - 1.3);
    if (h < 0.0) return 1.0;
    h = sqrt(h);
    bool blocked = (-b + h > 0.0) && (-b - h < maxT);
    return blocked ? 0.0 : 1.0;
}

// ---------------------------------------------------------------------------
// Surface shading
// ---------------------------------------------------------------------------

float3 shadeSurface(float3 p, float3 n, float3 viewDir)
{
    float3 absorption = P.absGlow.xyz;
    float3 albedo     = P.tint.xyz;
    float3 toLight    = P.lightFog.xyz - p;
    float  lightDist  = length(toLight);
    float3 L          = toLight / lightDist;
    float  irradiance = kLightPower / (lightDist * lightDist);

    // Subsurface transmission: refract into the material, measure how much of it
    // the light has to cross, and absorb per colour channel (Beer Lambert law). Thin
    // parts let lots of light through, thick parts filter it to deep colour.
    float3 refracted     = refract(viewDir, n, 1.0 / kIOR);
    float  pathLength    = thickness(p - n * 0.01, refracted);
    float3 transmittance = exp(-absorption * pathLength);
    float  forward       = pow(saturate(dot(refracted, L)), 3.0); // brighter when looking toward the light
    float3 transmitted   = kLightColor * (0.35 + 0.65 * albedo) * irradiance * transmittance * (0.35 + 3.0 * forward);

    // Shallow scattering near the surface: wrap lighting lets light bleed past
    // the terminator, like it does on skin or wax.
    float wrap = saturate((dot(n, L) + 0.6) / 1.6);
    float3 diffuse = albedo * kLightColor * irradiance * wrap * exp(-absorption * 0.35) * 0.35;

    // Reflection: Schlick Fresnel blends in a simple sky/floor environment and a
    // tight specular highlight from the spotlight.
    float  fresnel   = 0.04 + 0.96 * pow(1.0 - saturate(dot(n, -viewDir)), 5.0);
    float3 R         = reflect(viewDir, n);
    float3 env       = lerp(float3(0.02, 0.03, 0.035), float3(0.32, 0.28, 0.24), smoothstep(-0.2, 0.8, R.y));
    float  highlight = pow(saturate(dot(R, L)), 90.0) * 3.0;
    float3 reflected = env + highlight * kLightColor * irradiance * 0.12;

    return (transmitted + diffuse) * (1.0 - fresnel) + reflected * fresnel;
}

// ---------------------------------------------------------------------------
// Participating media
// ---------------------------------------------------------------------------

// Single scattering of the spotlight along the view ray, from the camera up to
// tEnd. Returns the in-scattered light, and `transmittance` is how much of whatever
// lies behind (the surface or background) still gets through the fog.
float3 integrateFog(float3 rayOrigin, float3 rayDir, float tEnd, float2 fragCoord, float time, out float transmittance)
{
    float3 lightPos  = P.lightFog.xyz;
    float3 spotAxis  = normalize(-lightPos);    // the spotlight points at the object
    float  fogScale  = P.lightFog.w;
    float  stepSize  = tEnd / float(kFogSamples);
    float  jitter    = hash3(float3(fragCoord, frac(time) * 37.0));

    float3 inScattered = float3(0.0);
    transmittance = 1.0;

    for (int i = 0; i < kFogSamples; i++)
    {
        float3 x       = rayOrigin + rayDir * ((float(i) + jitter) * stepSize);
        float3 fromLight = x - lightPos;
        float  lightDist = length(fromLight);
        float3 w       = fromLight / lightDist;

        // Soft-edged cone: 0 outside the beam, 1 in its core.
        float cone = smoothstep(0.88, 0.965, dot(w, spotAxis));

        // Outside the beam the fog only absorbs, so skip the noise and the shadow test.
        float density = fogScale * 0.03;
        if (cone > 0.0)
        {
            density = fogScale * (0.03 + 0.06 * valueNoise(x * 1.3 + float3(time * 0.08, time * 0.03, 0.0)));
            float visibility = sphereShadow(lightPos, w, lightDist);
            float phase = henyeyGreenstein(dot(w, -rayDir), kFogPhaseG);
            float3 lightHere = kLightColor * (kLightPower / (lightDist * lightDist)) * cone * visibility;
            inScattered += transmittance * density * lightHere * phase * stepSize * 4.0;
        }
        transmittance *= exp(-density * stepSize);
    }
    return inScattered;
}

// ---------------------------------------------------------------------------
// Debug colour ramps
// ---------------------------------------------------------------------------

// 0 → dark blue, 0.5 → teal, 1 → yellow.
float3 heatRamp(float k)
{
    float3 low = lerp(float3(0.05, 0.1, 0.45), float3(0.1, 0.8, 0.6), saturate(k * 2.0));
    return lerp(low, float3(1.0, 0.9, 0.2), saturate(k * 2.0 - 1.0));
}

// 0 → warm white (thin), 0.5 → orange, 1 → deep red (thick).
float3 thicknessRamp(float k)
{
    float3 thick = lerp(float3(0.95, 0.35, 0.1), float3(0.25, 0.02, 0.08), saturate(k * 2.0 - 1.0));
    return lerp(float3(1.0, 0.95, 0.75), thick, saturate(k * 2.0));
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

[shader("vertex")]
float4 vsMain(uint vertexId : SV_VertexID) : SV_Position
{
    return fullscreenTriangle(vertexId);
}

[shader("fragment")]
float4 fsMain(float4 svPosition : SV_Position) : SV_Target
{
    float2 resolution = P.resTime.xy;
    float  time       = P.resTime.z;
    float2 fragCoord  = fragCoordGL(svPosition, resolution, P.resTime.w);
    int    debugView  = int(P.tint.w + 0.5);

    // Orbit camera around the origin, and the subject can be shifted on screen.
    float camDist = P.offDistYaw.z;
    float camYaw  = P.offDistYaw.w;
    float2 uv = (fragCoord - 0.5 * resolution) / resolution.y - P.offDistYaw.xy;

    float3 rayOrigin = float3(sin(camYaw) * camDist, kCameraHeight, cos(camYaw) * camDist);
    float3 forward   = normalize(-rayOrigin);
    float3 right     = normalize(cross(forward, float3(0, 1, 0)));
    float3 up        = cross(right, forward);
    float3 rayDir    = normalize(uv.x * right + uv.y * up + kFocalLength * forward);
    float  farPlane  = camDist + 4.0;

    // Angle covered by one pixel. Used to make the hit test and the edge
    // anti-aliasing resolution-independent.
    float pixelAngle = 1.0 / (resolution.y * kFocalLength);

    // ---- 1. Bounding sphere -------------------------------------------------
    // Most pixels never come near the object: they skip sphere tracing entirely,
    // and the rest only march the stretch of ray inside the sphere.
    float tEnter, tExit;
    bool inBounds = raySphere(rayOrigin, rayDir, kBoundRadius, tEnter, tExit);

    // ---- 2. Sphere tracing --------------------------------------------------
    // Step along the ray by the SDF value (the largest step that can't skip a
    // surface). Two refinements:
    //  * The hit threshold grows with distance: once the surface is within a
    //    quarter pixel there is nothing left to resolve.
    //  * We remember the closest approach as an angle (distance / t). A ray that
    //    misses by less than a pixel still gets partial coverage, which gives
    //    smooth, anti-aliased silhouettes at any resolution.
    float t = tEnter;
    float hitT = -1.0;
    float lastDist = 1e9;
    float closestAngle = 1e9;
    float closestT = 0.0;
    int   steps = 0;
    bool  ranOutOfSteps = false;

    if (inBounds)
    {
        ranOutOfSteps = true;
        for (int i = 0; i < kMaxSteps; i++)
        {
            steps = i + 1;
            float d = sceneSDF(rayOrigin + rayDir * t);
            lastDist = d;

            float angle = d / max(t, 1e-3);
            if (angle < closestAngle) { closestAngle = angle; closestT = t; }

            if (d < max(0.0005, 0.25 * pixelAngle * t)) { hitT = t; ranOutOfSteps = false; break; }
            t += d * 0.9;                                    // slight under-relaxation for safety
            if (t > tExit) { ranOutOfSteps = false; break; } // left the bounding sphere: miss
        }
    }

    // A ray that runs out of steps while still hugging a surface (grazing angles)
    // is a hit, not a hole.
    bool resolvedAsHit = false;
    if (ranOutOfSteps && lastDist < 4.0 * pixelAngle * t)
    {
        hitT = t;
        ranOutOfSteps = false;
        resolvedAsHit = true;
    }
    bool hit = hitT > 0.0;
    float coverage = hit ? 1.0 : saturate(1.0 - closestAngle / pixelAngle);

    if (debugView == kDebugSteps)
    {
        // Cost per pixel: near-black = skipped by the bounding sphere,
        // blue → yellow = steps taken, magenta = lost ray, pink = rescued ray.
        if (!inBounds)     return float4(0.02, 0.02, 0.03, 1.0);
        if (ranOutOfSteps) return float4(1.0, 0.0, 1.0, 1.0);
        if (resolvedAsHit) return float4(1.0, 0.45, 0.9, 1.0);
        return float4(heatRamp(float(steps) / 48.0), 1.0);
    }

    // ---- 3. Surface shading -------------------------------------------------
    float3 color = kBackground;
    if (coverage > 0.001)
    {
        float3 p = rayOrigin + rayDir * (hit ? hitT : closestT);
        float3 n = sceneNormal(p);
        p -= n * sceneSDF(p); // project near-misses onto the surface before shading

        if (debugView == kDebugNormals)
            return float4(lerp(float3(0.02), n * 0.5 + 0.5, coverage), 1.0);

        if (debugView == kDebugThickness)
        {
            float pathLength = thickness(p - n * 0.01, refract(rayDir, n, 1.0 / kIOR));
            return float4(lerp(float3(0.02), thicknessRamp(saturate(pathLength / 2.2)), coverage), 1.0);
        }

        color = lerp(color, shadeSurface(p, n, rayDir), coverage);
    }
    else if (debugView == kDebugNormals || debugView == kDebugThickness)
    {
        return float4(0.02, 0.02, 0.02, 1.0);
    }

    // ---- 4. Participating media ---------------------------------------------
    float transmittance = 1.0;
    float3 fogLight = float3(0.0);
    if (debugView != kDebugNoFog)
        fogLight = integrateFog(rayOrigin, rayDir, hit ? hitT : farPlane, fragCoord, time, transmittance);

    if (debugView == kDebugFogOnly)
        color = float3(0.0);

    // ---- 5. Composite + tonemap ---------------------------------------------
    color = (color * transmittance + fogLight) * P.absGlow.w;
    return float4(finish(color, 1.25, fragCoord, resolution, 0.5), 1.0);
}
