import { useEffect, useState } from "react";
import { Skia, type SkImage } from "@shopify/react-native-skia";
import { File } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { report } from "../report";

export type SourceImage = {
  image: SkImage | null;
  /** Set when the file could not be turned into an image. */
  error: string | null;
  loading: boolean;
};

/**
 * Loads a picked photo into Skia, from its bytes.
 *
 * Not `useImage`: that one goes through `Skia.Data.fromURI`, which resolves the
 * string as a URL. A rejection there is swallowed by the hook, so a photo that
 * fails to load produces no image and no error, and the app silently keeps
 * showing the previous source. Reading the file ourselves removes the URL
 * handling from the path entirely and, more importantly, gives us something to
 * say when it fails.
 */
/**
 * Names the container when Skia will not decode it.
 *
 * "This image could not be decoded" is true and useless. Skia reads JPEG, PNG,
 * WebP and GIF and nothing else; every other container is a specific, nameable
 * format, and knowing which one is the difference between a bug report and a
 * shrug. HEIC is the one that matters: it is what an iPhone shoots.
 */
function undecodable(bytes: Uint8Array): string {
  const brand =
    bytes.length > 12 &&
    bytes[4] === 0x66 && // f
    bytes[5] === 0x74 && // t
    bytes[6] === 0x79 && // y
    bytes[7] === 0x70 // p
      ? String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11])
      : null;

  if (brand && /^(heic|heix|hevc|mif1|msf1)/.test(brand)) {
    return "This is a HEIC photo, which cannot be read here. Try another one.";
  }
  if (brand) {
    return `This image is in a format that cannot be read here (${brand.trim()}).`;
  }
  return "This image could not be decoded.";
}

/**
 * The same file, read by the system and handed back as a PNG.
 *
 * Skia reads JPEG, PNG, WebP and GIF, and a photo library is full of the rest:
 * HEIC from the camera, AVIF saved from a web page. The picker asks iOS for a
 * "compatible" representation, which covers the camera's own HEIC and nothing
 * else, so a photo that was imported rather than shot still arrives in
 * whatever container it was imported in, and that was the dead end.
 *
 * Both systems decode those: ImageIO on iOS 16 and later, `ImageDecoder` on
 * Android 12 and later, and whatever container comes after AVIF as well. So the
 * file goes through the one decoder on the phone that is kept up to date by
 * somebody else, and comes back as something Skia certainly reads.
 *
 * PNG and not JPEG, which is the same rule as the export: nothing in this
 * pipeline is allowed to add artefacts to what is drawn under the black. It is
 * the slowest step in the app, and it runs on a photo that was about to be
 * refused outright.
 */
async function transcoded(uri: string): Promise<Uint8Array> {
  const rendered = await ImageManipulator.manipulate(uri).renderAsync();
  const png = await rendered.saveAsync({ format: SaveFormat.PNG });
  return await new File(png.uri).bytes();
}

/**
 * The second chance, and the one thing it is allowed to cost.
 *
 * A failure here is not a new failure: it happens only where the photo was
 * already refused, and the person is told the same thing they would have been
 * told without it. It is reported under its own name because the reason is one
 * the other report cannot carry: `photo.open` says which container was refused,
 * this says what the system said when asked to read it anyway.
 */
async function decodedBySystem(uri: string): Promise<SkImage | null> {
  try {
    const bytes = await withDeadline(transcoded(uri), TRANSCODE_DEADLINE, "The system decoder");
    return Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
  } catch (e) {
    report("photo.transcode", e);
    return null;
  }
}

/**
 * What went wrong, in one line.
 */
function said(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * A promise that cannot hang.
 *
 * `Skia.Data.fromURI` resolves from a background thread when the read works
 * and, when it does not, sometimes never settles at all: the Android side
 * swallows its own exception, returns null, and nothing on the JS side is ever
 * called. A promise that never settles leaves the hook loading forever, which
 * on screen is the gradient standing in for an image that is never coming,
 * with nothing said anywhere. That is the worst of both: no picture and no
 * complaint. A deadline turns it back into a failure that can be reported.
 */
function withDeadline<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} never answered (${ms} ms)`)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** How long Skia gets. A local file either arrives at once or is not coming. */
const DEADLINE = 4000;

/**
 * How long the system decoder gets, which is much longer.
 *
 * Reading a file is not work and a decode is: twelve megapixels out of an AVIF
 * and back into a PNG, on the oldest phone this app runs on. The deadline is
 * here for the same reason as the one above, a promise that never settles, and
 * not to put a budget on the work.
 */
const TRANSCODE_DEADLINE = 12000;

/**
 * The bytes, or failing that the file.
 *
 * `expo-file-system` will only open what it considers readable: a path outside
 * the app's own directories has to pass `canRead()`, and a file that is not
 * there fails that the same way a forbidden one does, with "Missing 'READ'
 * permission for accessing the file". That is the right default for a file
 * manager and an ambiguous one here, which is why both attempts are reported
 * rather than only the last.
 *
 * So Skia reads it when the file system will not, under a deadline, and
 * whatever both of them said travels with the failure. The bytes are worth
 * having when they can be had: they are what names a HEIC when Skia will not
 * decode it.
 */
async function load(uri: string) {
  const tried: string[] = [];

  // A file, or something else entirely. `Skia.Data.fromURI` also takes what
  // React Native hands back for a bundled asset, which on an Android release
  // build is an Android resource name and not a path at all: no scheme, no
  // leading slash, nothing a file system can be asked about. Handing that to
  // `File` produced "URI has an authority component", which is true and beside
  // the point.
  if (uri.startsWith("file://") || uri.startsWith("/")) {
    try {
      const bytes = await new File(uri).bytes();
      const image = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
      if (image) {
        return { image, bytes };
      }
      // Read, and not decoded: the container is one Skia has no decoder for, so
      // the system is asked for the same picture in one that it does. The bytes
      // travel back either way, since they are what names the container to the
      // person holding the phone when this misses too.
      return { image: await decodedBySystem(uri), bytes };
    } catch (e) {
      tried.push(`File system: ${said(e)}`);
    }
  }

  try {
    const data = await withDeadline(Skia.Data.fromURI(uri), DEADLINE, "Skia");
    const image = Skia.Image.MakeImageFromEncoded(data);
    if (image) {
      return { image, bytes: null };
    }
    tried.push("Skia: read it, and could not decode it");
  } catch (e) {
    tried.push(`Skia: ${said(e)}`);
  }

  throw new Error(`${uri}\n\n${tried.join("\n")}`);
}

export function useSourceImage(uri: string | null): SourceImage {
  const [state, setState] = useState<SourceImage>({
    image: null,
    error: null,
    loading: false,
  });

  useEffect(() => {
    if (!uri) {
      setState({ image: null, error: null, loading: false });
      return;
    }

    let live = true;
    setState({ image: null, error: null, loading: true });

    // Every failure lands in the catch inside and becomes `error`, which App
    // reports as photo.open and shows. The outer catch is for a bug in that
    // catch itself, which would otherwise vanish.
    (async () => {
      try {
        const { image, bytes } = await load(uri);
        if (!live) {
          return;
        }
        if (!image) {
          setState({
            image: null,
            error: bytes ? undecodable(bytes) : "This image could not be decoded.",
            loading: false,
          });
          return;
        }
        setState({ image, error: null, loading: false });
      } catch (e) {
        if (live) {
          setState({
            image: null,
            error: e instanceof Error ? e.message : String(e),
            loading: false,
          });
        }
      }
    })().catch((e: unknown) => report("photo.load", e));

    return () => {
      live = false;
    };
  }, [uri]);

  return state;
}
