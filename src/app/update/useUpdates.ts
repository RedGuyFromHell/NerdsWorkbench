import { useCallback, useEffect, useState } from "react";
import { checkOnStartHere, realUpdateChecker, runUpdateCheck, startupNotice } from "./updateCheck";
import type { AvailableUpdate, UpdateCheckResult } from "./updateCheck";

/** The update state of the whole app: the automatic check on start, and "check now" for Settings. */
export function useUpdates() {
  const [offered, setOffered] = useState<AvailableUpdate | null>(null);
  const [notice, setNotice] = useState("");

  const checkNow = useCallback(async (): Promise<UpdateCheckResult> => {
    const result = await runUpdateCheck(realUpdateChecker);
    if (result.kind === "available") setOffered(result.update);
    return result;
  }, []);

  useEffect(() => {
    if (!checkOnStartHere()) return;
    let cancelled = false;
    void runUpdateCheck(realUpdateChecker).then((result) => {
      if (cancelled) return;
      setNotice(startupNotice(result));
      if (result.kind === "available") setOffered(result.update);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = useCallback(() => setOffered(null), []);

  return { offered, notice, checkNow, dismiss };
}
