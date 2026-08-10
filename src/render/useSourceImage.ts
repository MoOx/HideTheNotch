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
        const bytes = await new File(uri).bytes();
        const data = Skia.Data.fromBytes(bytes);
        const image = Skia.Image.MakeImageFromEncoded(data);
        if (!live) {
          return;
        }
        if (!image) {
          setState({ image: null, error: undecodable(bytes), loading: false });
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
