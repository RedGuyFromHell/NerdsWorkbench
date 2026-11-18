// Download progress for the update prompt. The updater plugin reports a download as three
// events; this folds them into one state the progress bar can show.

/** The events the updater plugin sends while downloading (the shape of its DownloadEvent). */
export type DownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

export interface DownloadProgress {
  downloaded: number;
  /** Bytes in total, or null when the server did not say. */
  total: number | null;
}

export const NO_PROGRESS: DownloadProgress = { downloaded: 0, total: null };

export function applyDownloadEvent(
  state: DownloadProgress,
  event: DownloadEvent,
): DownloadProgress {
  switch (event.event) {
    case "Started":
      return { downloaded: 0, total: event.data.contentLength ?? null };
    case "Progress":
      return { ...state, downloaded: state.downloaded + event.data.chunkLength };
    case "Finished":
      return { ...state, downloaded: state.total ?? state.downloaded };
  }
}

/** 0 to 1 for the progress bar, or null while the total is unknown (an indeterminate bar). */
export function progressFraction(state: DownloadProgress): number | null {
  if (state.total === null || state.total <= 0) return null;
  return Math.min(1, state.downloaded / state.total);
}
