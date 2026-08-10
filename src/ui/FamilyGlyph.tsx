import { useMemo } from "react";
import {
  Canvas,
  ClipOp,
  PaintStyle,
  Picture,
  Skia,
  TileMode,
  createPicture,
} from "@shopify/react-native-skia";

import type { MaskFamily } from "../recipe/types";

const SIZE = 20;

/**
 * A small picture of what the family does, next to the control that drives it.
 *
 * Not an SF Symbol: there is no system glyph for "black at the top dissolving
 * into the wallpaper", and the three of them have to be distinguishable at a
 * glance from each other, which a borrowed approximation would not be. Each is
 * the effect itself, drawn at 20 points inside the same rounded frame, so the
 * set reads as one family of marks.
 */
export function FamilyGlyph({ family, color }: { family: MaskFamily; color: string }) {
  const picture = useMemo(() => {
    const c = Skia.Color(color);
    return createPicture(
      (canvas) => {
        const paint = Skia.Paint();
        paint.setAntiAlias(true);
        paint.setColor(c);

        const r = Skia.RRectXY(Skia.XYWHRect(1, 1, SIZE - 2, SIZE - 2), 5, 5);
        canvas.save();
        canvas.clipRRect(r, ClipOp.Intersect, true);

        // The frame, so all three sit in the same shape.
        const frame = Skia.Paint();
        frame.setAntiAlias(true);
        frame.setColor(c);
        frame.setAlphaf(0.3);
        frame.setStyle(PaintStyle.Stroke);
        frame.setStrokeWidth(1.2);

        switch (family) {
          case "fade": {
            // Solid at the top, dissolving downward.
            const shader = Skia.Shader.MakeLinearGradient(
              { x: 0, y: 1 },
              { x: 0, y: SIZE - 5 },
              [c, Skia.Color("#00000000")],
              null,
              TileMode.Clamp,
            );
            const g = Skia.Paint();
            g.setAntiAlias(true);
            g.setShader(shader);
            canvas.drawRect(Skia.XYWHRect(1, 1, SIZE - 2, SIZE - 2), g);
            break;
          }
          case "bar":
            // One band across the top.
            canvas.drawRect(Skia.XYWHRect(1, 1, SIZE - 2, 6.5), paint);
            break;
          case "stripes": {
            // Slats thinning as they go down, on an opening grid.
            let y = 1;
            let h = 4.2;
            let gap = 1.6;
            for (let i = 0; i < 5 && y < SIZE - 2; i += 1) {
              canvas.drawRect(Skia.XYWHRect(1, y, SIZE - 2, Math.max(h, 0.6)), paint);
              y += h + gap;
              h *= 0.62;
              gap *= 1.35;
            }
            break;
          }
        }

        canvas.restore();
        canvas.drawRRect(r, frame);
      },
      Skia.XYWHRect(0, 0, SIZE, SIZE),
    );
  }, [family, color]);

  return (
    <Canvas style={{ width: SIZE, height: SIZE }}>
      <Picture picture={picture} />
    </Canvas>
  );
}
