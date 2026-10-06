/**
 * GLSL for the brain renderer.
 *
 * Layer responsibilities:
 *   shell     — cortical surface: folding, lighting, fresnel, activity field
 *   core      — inner volume: the activity field seen *through* the shell
 *   connection— pathway tubes with a travelling illumination pulse
 *   signal    — instanced signal particles (position computed on the CPU)
 *   dust      — ambient GPU particle field, animated entirely in the shader
 *
 * The activity field is computed per *vertex*, not per fragment. A 35-iteration
 * loop at fragment rate would be far too expensive at full resolution; at vertex
 * rate on a 40k-vertex mesh it is free, and a soft glow interpolates perfectly.
 */

/** Shared: accumulate the activity field from all region sources. */
export const ACTIVITY_FIELD_GLSL = /* glsl */ `
  uniform vec4  uRegion[REGION_COUNT];    // xyz = position, w = radius
  uniform vec4  uRegionCol[REGION_COUNT]; // rgb = colour, a = bilateral flag
  uniform float uRegionAct[REGION_COUNT];
  uniform float uRegionMask[REGION_COUNT];

  // Returns accumulated colour in .rgb and total amplitude in .a
  vec4 activityField(vec3 p, float reach) {
    vec3 acc = vec3(0.0);
    float amp = 0.0;
    for (int i = 0; i < REGION_COUNT; i++) {
      float a = uRegionAct[i] * uRegionMask[i];
      if (a < 0.015) continue;
      vec4 R = uRegion[i];
      float d = distance(p, R.xyz);
      if (uRegionCol[i].a > 0.5) {
        d = min(d, distance(p, vec3(-R.x, R.y, R.z)));
      }
      float f = 1.0 - smoothstep(0.0, R.w * reach, d);
      f *= f;
      acc += uRegionCol[i].rgb * (f * a);
      amp += f * a;
    }
    return vec4(acc, amp);
  }
`;

export const SHELL_VERT = /* glsl */ `
  attribute float aFold;
  attribute float aHemi;
  attribute float aLobe;
  attribute vec3  aDir;
  attribute vec3  aFoldGrad;

  uniform float uTime;
  uniform float uFieldReach;
  uniform float uBreath;

  varying vec3  vNormal;
  varying vec3  vLocal;
  varying vec3  vViewDir;
  varying float vFold;
  varying float vLobe;
  varying float vHemi;
  varying vec3  vField;
  varying float vFieldAmt;
  varying vec3  vGrad;

  ${ACTIVITY_FIELD_GLSL}

  void main() {
    vec3 p = position;

    // A very slight global breathing so the brain never looks like a still frame.
    p *= 1.0 + uBreath * 0.004 * sin(uTime * 0.6 + p.z * 1.4);

    vec4 field = activityField(p, uFieldReach);

    // Active tissue swells almost imperceptibly — enough to be felt, not seen.
    p += normalize(p) * min(field.a, 1.0) * 0.009;

    vLocal = p;
    vFold = aFold;
    vLobe = aLobe;
    vHemi = aHemi;
    vField = field.rgb;
    vFieldAmt = field.a;
    // The gradient is a tangent vector, so it transforms with the normal.
    vGrad = normalMatrix * aFoldGrad;

    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mvPosition.xyz);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const SHELL_FRAG = /* glsl */ `
  precision highp float;

  uniform vec3  uSurface;      // gyral crown colour
  uniform vec3  uSulcus;       // fold interior colour
  uniform vec3  uRim;          // fresnel accent
  uniform vec3  uSSS;          // subsurface transmission tint
  uniform float uOpacity;
  uniform float uTime;
  uniform float uActivityGain; // how strongly the field shows through
  uniform float uAnatomyTint;  // 0 = flat, 1 = lobe-tinted
  uniform float uGrain;
  uniform float uWireframeMix;
  uniform float uHighContrast;
  uniform float uSheen;        // wet-surface specular amount
  uniform float uBump;         // strength of the fold-gradient relief

  varying vec3  vNormal;
  varying vec3  vLocal;
  varying vec3  vViewDir;
  varying float vFold;
  varying float vLobe;
  varying float vHemi;
  varying vec3  vField;
  varying float vFieldAmt;
  varying vec3  vGrad;

  // Cheap hash for film grain.
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  // Subtle per-lobe tint, used only in the Anatomy lens.
  vec3 lobeTint(float id) {
    if (id < 0.5) return vec3(0.68, 0.70, 0.80); // frontal
    if (id < 1.5) return vec3(0.56, 0.72, 0.80); // occipital
    if (id < 2.5) return vec3(0.80, 0.66, 0.62); // temporal
    if (id < 3.5) return vec3(0.63, 0.76, 0.72); // parietal
    if (id < 4.5) return vec3(0.73, 0.65, 0.76); // central
    if (id < 5.5) return vec3(0.60, 0.76, 0.67); // cerebellum
    return vec3(0.78, 0.70, 0.58);               // brainstem
  }

  /**
   * Wrapped diffuse. Light bleeds past the geometric terminator, which is what
   * soft biological tissue actually does and what stops the surface reading as
   * hard plastic.
   */
  float wrapDiffuse(vec3 n, vec3 l, float w) {
    return clamp((dot(n, l) + w) / (1.0 + w), 0.0, 1.0);
  }

  void main() {
    // Tilt the interpolated normal by the fold gradient. This is where almost
    // all of the apparent surface detail comes from: the mesh carries the
    // macro folds, this carries everything finer than a triangle.
    vec3 N = normalize(normalize(vNormal) - vGrad * uBump);
    vec3 V = normalize(vViewDir);

    // Creases catch less light. Reusing the gradient magnitude as a cheap
    // cavity term deepens the fine sulci the normal perturbation just implied.
    float cavity = 1.0 - clamp(length(vGrad) * uBump * 0.8, 0.0, 0.4);

    // Three-point rig. A full PBR pipeline would fight the stylisation; this
    // keeps the surface readable at every camera distance and lets the activity
    // field stay the brightest thing on screen.
    vec3 keyDir  = normalize(vec3(0.42, 0.78, 0.46));
    vec3 fillDir = normalize(vec3(-0.72, -0.08, 0.34));
    vec3 backDir = normalize(vec3(0.06, -0.32, -0.9));

    float key  = wrapDiffuse(N, keyDir, 0.45);
    float fill = wrapDiffuse(N, fillDir, 0.7);
    float back = max(dot(N, backDir), 0.0);

    // Fold shading. Sulci are darker, cooler and less lit; this contrast is most
    // of what makes the surface read as folded rather than merely noisy.
    float foldShade = smoothstep(0.2, 0.86, vFold);
    float crown = smoothstep(0.62, 1.0, vFold);
    vec3 base = mix(uSulcus, uSurface, foldShade);
    base = mix(base, base * lobeTint(vLobe) * 1.5, uAnatomyTint * 0.6);

    // Occlusion approximated from fold depth: deep creases receive less of the
    // hemisphere, so darken them non-linearly.
    float ao = mix(0.22, 1.0, pow(foldShade, 0.85));

    vec3 lit = base * (0.09 + key * 0.8 + fill * 0.2) * ao * cavity;
    lit += uSurface * back * 0.085 * ao;

    // Subsurface transmission: thin ridges glow slightly from the far side,
    // warm and reddish, the way lit tissue does.
    float trans = pow(wrapDiffuse(-N, keyDir, 0.9), 2.4);
    lit += uSSS * trans * 0.16 * crown;

    // Wet specular sheen, concentrated on gyral crowns where a real surface
    // catches the light.
    vec3 H = normalize(keyDir + V);
    float spec = pow(max(dot(N, H), 0.0), 46.0);
    lit += vec3(1.0) * spec * 0.18 * crown * uSheen;

    // Fresnel rim — the single most important cue for reading the silhouette
    // against a near-black background.
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.4);
    lit += uRim * fres * 0.34;

    // Activity field, additive and gamma-shaped so low levels stay subtle.
    float amt = clamp(vFieldAmt, 0.0, 1.6);
    vec3 glow = vField * pow(amt, 0.76) * uActivityGain;
    // Activity pools in sulci and rims the silhouette, which reads as light
    // coming from inside the volume rather than painted on the surface.
    glow *= 0.6 + 0.62 * fres + (1.0 - foldShade) * 0.35;
    lit += glow;

    // Faint equal-depth contour lines: a scientific-illustration cue that also
    // conveys curvature where the lighting alone goes flat.
    float iso = abs(fract(vFold * 16.0) - 0.5);
    lit += uRim * smoothstep(0.47, 0.5, iso) * 0.055 * uWireframeMix;

    // Grain, disabled in high-contrast mode.
    float g = (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * uGrain;
    lit += g * (1.0 - uHighContrast);

    lit = mix(lit, lit * 1.3 + 0.035, uHighContrast);

    float alpha = uOpacity;
    // Keep the rim and the active tissue visible even when the shell is turned
    // transparent, so the silhouette never disappears entirely.
    float keep = max(fres * 0.6, min(amt, 1.0) * 0.5);
    alpha = max(alpha, keep * step(0.015, uOpacity));

    gl_FragColor = vec4(lit, clamp(alpha, 0.0, 1.0));
  }
`;

/**
 * The inner activity volume. Rendered back-faces-only with additive blending so
 * it reads as light inside a translucent object rather than a solid core.
 */
export const CORE_VERT = /* glsl */ `
  uniform float uTime;
  uniform float uFieldReach;

  varying vec3  vField;
  varying float vFieldAmt;
  varying vec3  vNormal;
  varying vec3  vViewDir;

  ${ACTIVITY_FIELD_GLSL}

  void main() {
    vec4 field = activityField(position, uFieldReach);
    vField = field.rgb;
    vFieldAmt = field.a;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vNormal = normalize(normalMatrix * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const CORE_FRAG = /* glsl */ `
  precision highp float;
  uniform float uGain;
  uniform float uTime;

  varying vec3  vField;
  varying float vFieldAmt;
  varying vec3  vNormal;
  varying vec3  vViewDir;

  void main() {
    // Thickness approximation: grazing angles accumulate more "volume".
    float facing = 1.0 - abs(dot(normalize(vNormal), normalize(vViewDir)));
    float thickness = pow(facing, 1.4);
    float amt = clamp(vFieldAmt, 0.0, 1.8);
    float flicker = 0.92 + 0.08 * sin(uTime * 7.0 + vFieldAmt * 11.0);
    vec3 c = vField * pow(amt, 0.72) * uGain * (0.35 + thickness) * flicker;
    gl_FragColor = vec4(c, 1.0);
  }
`;

export const CONNECTION_VERT = /* glsl */ `
  attribute float aT;        // 0..1 along the pathway
  attribute float aSlot;     // connection index, for the state texture
  attribute float aFlow;     // +1 feed-forward, -1 feedback, 0 bidirectional
  attribute float aStrength;
  attribute vec3  aColor;

  uniform sampler2D uConnTex; // r = activation, g = mask, b = flow rate
  uniform float uConnTexWidth;
  uniform float uTime;
  uniform float uThickness;

  varying vec3  vColor;
  varying float vT;
  varying float vAct;
  varying float vMask;
  varying float vFlow;
  varying float vStrength;

  void main() {
    float u = (aSlot + 0.5) / uConnTexWidth;
    vec3 st = texture2D(uConnTex, vec2(u, 0.5)).rgb;

    vColor = aColor;
    vT = aT;
    vAct = st.r;
    vMask = st.g;
    vFlow = aFlow;
    vStrength = aStrength;

    // Active pathways thicken very slightly. The normal here is the tube's
    // radial direction, generated when the geometry was built. Displacement is
    // capped at roughly half a tube radius: enough to register, nowhere near
    // enough to turn a thin tube into a ribbon.
    vec3 p = position + normal * (st.r * uThickness * 0.0025);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const CONNECTION_FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uBaseAlpha;
  uniform float uPulse;

  varying vec3  vColor;
  varying float vT;
  varying float vAct;
  varying float vMask;
  varying float vFlow;
  varying float vStrength;

  void main() {
    // Resting visibility is proportional to conceptual strength, so the static
    // network already has structure before anything activates.
    float rest = uBaseAlpha * (0.25 + vStrength * 0.75);

    // A travelling illumination band. Feedback pathways run the other way, which
    // is how direction is read without drawing arrowheads.
    float dir = vFlow == 0.0 ? 1.0 : vFlow;
    float phase = fract(uTime * 0.28 * dir + vStrength * 3.17 + vT * -dir);
    float band = exp(-pow((phase - 0.5) * 7.0, 2.0));

    // Bidirectional pathways get a second counter-travelling band.
    if (vFlow == 0.0) {
      float phase2 = fract(uTime * 0.22 - vT + vStrength * 1.7);
      band = max(band, exp(-pow((phase2 - 0.5) * 7.0, 2.0)) * 0.7);
    }

    float a = rest + vAct * (0.3 + band * uPulse * 0.55);
    a *= vMask;

    // Taper the very ends so tubes do not terminate in a hard disc.
    a *= smoothstep(0.0, 0.06, vT) * smoothstep(1.0, 0.94, vT);

    if (a < 0.004) discard;

    vec3 c = vColor * (0.4 + vAct * 0.75 + band * vAct * 0.9);
    gl_FragColor = vec4(c, a);
  }
`;

/** Instanced signal particles. Positions are written by the CPU each frame. */
export const SIGNAL_VERT = /* glsl */ `
  attribute vec3 aOffset;     // world position for this instance
  attribute vec4 aParams;     // x = size, y = brightness, z = trailFade, w = seed
  attribute vec3 aColor;

  uniform float uTime;
  uniform float uScale;

  varying vec3  vColor;
  varying float vBright;
  varying vec2  vUv;

  void main() {
    vColor = aColor;
    vBright = aParams.y;
    vUv = uv;

    float size = aParams.x * uScale;
    // Billboard: expand the quad in view space so particles always face camera.
    vec4 mv = modelViewMatrix * vec4(aOffset, 1.0);
    mv.xy += position.xy * size;
    gl_Position = projectionMatrix * mv;
  }
`;

export const SIGNAL_FRAG = /* glsl */ `
  precision highp float;
  varying vec3  vColor;
  varying float vBright;
  varying vec2  vUv;

  void main() {
    vec2 d = vUv - 0.5;
    float r = length(d) * 2.0;
    if (r > 1.0) discard;
    // A tight core with a wide soft halo reads as light rather than as a dot.
    float core = exp(-r * r * 11.0);
    float halo = exp(-r * r * 2.2) * 0.45;
    float a = (core + halo) * vBright;
    gl_FragColor = vec4(vColor * (core * 2.4 + halo), a);
  }
`;

/**
 * Ambient neural dust. Entirely GPU-animated: the CPU writes seed positions
 * once and then only updates uTime, so thousands of particles cost nothing.
 */
export const DUST_VERT = /* glsl */ `
  attribute vec3  aSeed;
  attribute float aPhase;
  attribute float aSize;

  uniform float uTime;
  uniform float uScale;
  uniform float uSpread;
  uniform float uDrift;
  uniform float uPixelRatio;

  varying float vAlpha;
  varying float vPhase;

  void main() {
    vec3 p = aSeed * uSpread;

    // Three incommensurate sinusoids per axis — cheap, and never visibly loops.
    float t = uTime * uDrift;
    p.x += sin(t * 0.43 + aPhase * 6.283) * 0.045;
    p.y += sin(t * 0.37 + aPhase * 11.1) * 0.05;
    p.z += sin(t * 0.51 + aPhase * 8.4) * 0.045;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    // Slow asynchronous twinkle; this is what makes the field feel alive.
    float twinkle = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 1.3 + aPhase * 19.0), 2.0);
    vAlpha = twinkle;
    vPhase = aPhase;
    gl_PointSize = aSize * uScale * uPixelRatio * (1.0 / max(-mv.z, 0.2));
    gl_Position = projectionMatrix * mv;
  }
`;

export const DUST_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;

  varying float vAlpha;
  varying float vPhase;

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    if (r > 1.0) discard;
    float a = exp(-r * r * 4.5) * vAlpha * uOpacity;
    vec3 c = mix(uColorA, uColorB, vPhase);
    gl_FragColor = vec4(c * (0.6 + a), a);
  }
`;

/**
 * Region marker: a soft, fresnel-lit blob per region instance.
 *
 * Position and scale ride on `instanceMatrix` (written by the CPU each frame,
 * which is cheap for ~60 instances) so that three's InstancedMesh raycasting
 * keeps working and clicks resolve to a region for free.
 */
export const MARKER_VERT = /* glsl */ `
  attribute vec3  aColor;
  attribute vec4  aState; // x = level, y = onset, z = emphasis, w = mask

  uniform float uTime;

  varying vec3  vColor;
  varying float vLevel;
  varying float vOnset;
  varying float vMask;
  varying float vEmphasis;
  varying vec3  vNormal;
  varying vec3  vViewDir;

  void main() {
    vColor = aColor;
    vLevel = aState.x;
    vOnset = aState.y;
    vEmphasis = aState.z;
    vMask = aState.w;

    vec4 local = instanceMatrix * vec4(position, 1.0);
    vec4 mv = modelViewMatrix * local;
    vNormal = normalize(normalMatrix * mat3(instanceMatrix) * normal);
    vViewDir = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const MARKER_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform float uOpacity;

  varying vec3  vColor;
  varying float vLevel;
  varying float vOnset;
  varying float vMask;
  varying float vEmphasis;
  varying vec3  vNormal;
  varying vec3  vViewDir;

  void main() {
    float fres = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0), 2.0);
    float body = 0.06 + vLevel * 0.3;
    float a = (body * 0.3 + fres * (0.2 + vLevel * 0.55)) * vMask * uOpacity;
    a += vEmphasis * (0.08 + fres * 0.3);
    if (a < 0.004) discard;
    vec3 c = vColor * (0.35 + vLevel * 1.1 + vOnset * 0.8 + fres * 0.5 + vEmphasis * 0.7);
    gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
  }
`;
