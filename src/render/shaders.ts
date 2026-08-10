import { Skia } from "@shopify/react-native-skia";

/**
 * Foundation C, the fade.
 *
 * The shader does not composite translucent black over the source: it
 * **receives the source** (`uSrc`) and computes the final colour itself. That
 * is what makes the dithering work.
 *
 * Compositing black with alpha `a` amounts to multiplying the value by `1 - a`.
 * Dithering the alpha therefore does not dither the output: the noise is
 * attenuated by the luminance of the source, the more so the darker it is, and
 * that is exactly where banding shows. By producing the final colour we apply
 * the noise where 8 bit quantisation actually happens, at plus or minus 1 LSB,
 * which is the right amount whatever the source.
 *
 * The fade itself is computed in **linear light**: since
 * `encode(x * k) is roughly encode(x) * k^(1/2.2)` for a power law, multiplying
 * the sRGB value by `(1 - c)^(1/2.2)` makes the light decay linearly. A
 * gradient interpolated directly in sRGB dives too fast, and its midpoint
 * already looks close to black.
 */
const FADE_SKSL = `
uniform shader uSrc;
uniform float uSolidEnd;
uniform float uFadeEnd;
uniform float uCurve;
uniform float uScale;

float hash(float2 p) {
  return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453123);
}

half4 main(float2 xy) {
  half4 src = uSrc.eval(xy);

  float span = max(uFadeEnd - uSolidEnd, 0.001);
  float t = clamp((xy.y - uSolidEnd) / span, 0.0, 1.0);

  // Coverage we want: 1 is absolute black, 0 is the untouched source.
  float c = 1.0 - t;
  if (uCurve > 1.5) {
    c = c * c * (3.0 - 2.0 * c);
  } else if (uCurve > 0.5) {
    c = c * c;
  }

  float k = pow(max(1.0 - c, 0.0), 1.0 / 2.2);
  float3 rgb = float3(src.rgb) * k;

  // Triangular probability density dither over plus or minus 1 LSB, the
  // reference amount for masking 8 bit quantisation without visible grain.
  // Computed in output pixels so it stays one pixel wide at any export size.
  float2 px = xy * uScale;
  float n = hash(px) - hash(px + float2(17.31, 5.77));
  rgb += n * (1.0 / 255.0);

  return half4(half3(clamp(rgb, 0.0, 1.0)), 1.0);
}
`;

export const fadeEffect = Skia.RuntimeEffect.Make(FADE_SKSL);

/**
 * Foundation D, the gradient.
 *
 * A gradient given as coloured points, each pulling its colour over the screen.
 * The weight is
 *
 *     w = exp(-d² · 6) / (d² + 0.004)
 *
 * which is two things at once and needs both. The `1/d²` is inverse distance
 * weighting: it goes to infinity at the point, so the colour **at** a point is
 * that point's colour, which is what makes dragging a handle mean something.
 * On its own it also reaches across the whole screen, and every point pulling
 * on every pixel gives creases where two influences trade places, and colours
 * washed toward the average everywhere else. The Gaussian is what fences it in:
 * by the far edge it has fallen to a quarter of a percent, so a point governs
 * its own region and lets go of the rest.
 *
 * A plain Gaussian alone was the other candidate and is the smoothest of the
 * three, but its colour at a point is a blend, so setting a point to pure red
 * gives a pink handle. That is not a gradient the user can steer.
 *
 * Mixed in **linear light**, then encoded. sRGB interpolation between two
 * saturated colours goes through a muddy middle, which is the same reasoning as
 * the fade, and dithered for the same reason as the fade: a gradient this
 * smooth over a screen this large is exactly where 8 bit banding shows.
 */
const MESH_SKSL = `
uniform float2 uRes;
uniform float  uCount;
uniform float  uScale;
uniform float4 uPt[8];
uniform float4 uCol[8];

float hash(float2 p) {
  return fract(sin(dot(p, float2(12.9898, 78.233))) * 43758.5453123);
}

half4 main(float2 xy) {
  float2 p = xy / uRes;

  float3 acc = float3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 8; i++) {
    // The trip count has to be constant, but the break may test a uniform, so
    // an unused slot costs nothing rather than one dead exp per pixel.
    if (float(i) >= uCount) { break; }
    float2 d = p - uPt[i].xy;
    float d2 = dot(d, d);
    float w = exp(-d2 * 6.0) / (d2 + 0.004);
    acc += uCol[i].rgb * w;
    wsum += w;
  }

  float3 rgb = pow(max(acc / max(wsum, 1e-6), 0.0), float3(1.0 / 2.2));

  float2 px = xy * uScale;
  float n = hash(px) - hash(px + float2(17.31, 5.77));
  rgb += n * (1.0 / 255.0);

  return half4(half3(clamp(rgb, 0.0, 1.0)), 1.0);
}
`;

export const meshEffect = Skia.RuntimeEffect.Make(MESH_SKSL);

if (__DEV__ && !fadeEffect) {
  console.warn("[HideTheNotch] The fade shader failed to compile.");
}

if (__DEV__ && !meshEffect) {
  console.warn("[HideTheNotch] The gradient shader failed to compile.");
}
