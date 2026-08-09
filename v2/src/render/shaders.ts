import { Skia } from "@shopify/react-native-skia";

/**
 * Socle C — le fondu.
 *
 * Le shader ne pose pas du noir semi-transparent par-dessus la source : il
 * **reçoit la source** (`uSrc`) et calcule lui-même la couleur finale. C'est
 * indispensable pour le dithering.
 *
 * Composer du noir avec un alpha `a` revient à multiplier la valeur par
 * `1 - a`. Dithérer l'alpha ne dithère donc pas la sortie : le bruit y est
 * atténué par la luminance de la source, d'autant plus qu'elle est sombre — et
 * c'est précisément là que le banding se voit. En sortant la couleur finale, on
 * applique le bruit là où la quantification 8 bits a lieu, à ±0,5 LSB, ce qui
 * est la valeur juste quelle que soit la source.
 *
 * Le fondu lui-même est calculé en **lumière linéaire** : comme
 * `encode(x·k) ≈ encode(x)·k^(1/2,2)` pour une loi de puissance, multiplier la
 * valeur sRGB par `(1-c)^(1/2,2)` fait décroître la lumière linéairement. Un
 * dégradé interpolé directement en sRGB plonge trop vite : son milieu paraît
 * déjà presque noir.
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

  // Couverture voulue : 1 = noir absolu, 0 = source intacte.
  float c = 1.0 - t;
  if (uCurve > 1.5) {
    c = c * c * (3.0 - 2.0 * c);
  } else if (uCurve > 0.5) {
    c = c * c;
  }

  float k = pow(max(1.0 - c, 0.0), 1.0 / 2.2);
  float3 rgb = float3(src.rgb) * k;

  // Dithering à densité triangulaire sur ±1 LSB — la valeur de référence pour
  // masquer une quantification 8 bits sans grain perceptible. Calculé en pixels
  // de sortie pour rester d'un pixel quelle que soit la résolution d'export.
  float2 px = xy * uScale;
  float n = hash(px) - hash(px + float2(17.31, 5.77));
  rgb += n * (1.0 / 255.0);

  return half4(half3(clamp(rgb, 0.0, 1.0)), 1.0);
}
`;

export const fadeEffect = Skia.RuntimeEffect.Make(FADE_SKSL);

if (__DEV__ && !fadeEffect) {
  console.warn("[HideTheNotch] Le shader de fondu n'a pas compilé.");
}
