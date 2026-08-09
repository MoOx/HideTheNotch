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

if (__DEV__ && !fadeEffect) {
  console.warn("[HideTheNotch] The fade shader failed to compile.");
}
