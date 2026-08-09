import { PaintStyle, Skia, type SkCanvas } from "@shopify/react-native-skia";

import type { Geometry } from "../geometry/devices";

/**
 * A home screen, sketched.
 *
 * **Preview only. This never reaches the export**, which is why it lives beside
 * `drawRecipe` instead of inside it: the exported wallpaper is the recipe and
 * nothing else.
 *
 * A wallpaper on its own does not tell you whether the mask works. The question
 * is always "does the black read as hardware once there are icons on top of
 * it", and that only has an answer with icons on top of it. These are deliberately
 * blank: recognisable apps would pull the eye exactly where it should not go.
 *
 * Later: let the user hand in a screenshot of their own home screen and use it
 * here instead. Same idea, real icons, real spacing.
 */
export function drawHomeScreen(canvas: SkCanvas, g: Geometry) {
  const cols = 4;
  const margin = g.width * 0.07;
  const cell = (g.width - margin * 2) / cols;
  const size = cell * 0.66;
  const radius = size * 0.235;
  const pad = (cell - size) / 2;

  // The first row clears the status bar, the way the system lays it out. Icons
  // never sit under the cutout, so the mask is judged against the row below it,
  // and a bar tall enough to swallow that row says so plainly.
  const top = Math.max(g.insetTop, 24) + g.height * 0.035;
  const rowGap = cell * 0.3;
  const rows = 6;

  const paint = Skia.Paint();
  paint.setAntiAlias(true);
  paint.setColor(Skia.Color("rgba(255,255,255,0.17)"));

  const edge = Skia.Paint();
  edge.setAntiAlias(true);
  edge.setStyle(PaintStyle.Stroke);
  edge.setStrokeWidth(1);
  edge.setColor(Skia.Color("rgba(255,255,255,0.22)"));

  for (let r = 0; r < rows; r += 1) {
    const y = top + r * (size + rowGap);
    for (let c = 0; c < cols; c += 1) {
      const x = margin + c * cell + pad;
      const rect = Skia.RRectXY(Skia.XYWHRect(x, y, size, size), radius, radius);
      canvas.drawRRect(rect, paint);
      canvas.drawRRect(rect, edge);
    }
  }

  // The dock, which is the one part of a home screen that is a single shape.
  const dockH = size + pad * 2;
  const dockY = g.height - g.insetBottom - dockH - g.height * 0.012;
  const dock = Skia.RRectXY(
    Skia.XYWHRect(margin * 0.6, dockY, g.width - margin * 1.2, dockH),
    dockH * 0.32,
    dockH * 0.32
  );
  const dockPaint = Skia.Paint();
  dockPaint.setAntiAlias(true);
  dockPaint.setColor(Skia.Color("rgba(255,255,255,0.10)"));
  canvas.drawRRect(dock, dockPaint);

  for (let c = 0; c < cols; c += 1) {
    const x = margin + c * cell + pad;
    const rect = Skia.RRectXY(
      Skia.XYWHRect(x, dockY + pad, size, size),
      radius,
      radius
    );
    canvas.drawRRect(rect, paint);
    canvas.drawRRect(rect, edge);
  }
}
