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
          setState({ image: null, error: "This image could not be decoded.", loading: false });
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
