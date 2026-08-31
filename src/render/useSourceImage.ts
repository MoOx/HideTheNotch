import { useEffect, useState } from "react";
import { Skia, type SkImage } from "@shopify/react-native-skia";
import { File } from "expo-file-system";

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
      return { image: Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes)), bytes };
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
    })();

    return () => {
      live = false;
    };
  }, [uri]);

  return state;
}
