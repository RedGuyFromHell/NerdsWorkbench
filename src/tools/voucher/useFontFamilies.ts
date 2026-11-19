import { useEffect, useState } from "react";
import { errorText } from "../../lib/errors";
import { listFontFamilies } from "../../lib/fonts";

/** The installed font families: empty until they are read. A failure goes to `onError`, which must be stable. */
export function useFontFamilies(onError: (message: string) => void): string[] {
  const [families, setFamilies] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    void listFontFamilies().then(
      (installed) => {
        if (mounted) setFamilies(installed);
      },
      (error: unknown) => {
        if (mounted) onError(`The font list could not be read: ${errorText(error)}`);
      },
    );
    return () => {
      mounted = false;
    };
  }, [onError]);

  return families;
}
