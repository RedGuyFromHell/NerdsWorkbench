// Reads and writes the payout files: settings, people, remembered choices, paid marks and one
// file per month. The same parsing code runs over two backends, the app data folder (desktop app)
// and memory (a plain browser, and the tests). A file that is missing gives the defaults; a file
// that is broken or of an unknown version throws with its name, so real data is never replaced
// by defaults without anyone noticing.
import type { z } from "zod";
import { isTauri } from "../../../lib/platform";
import {
  DEFAULT_CHOICES,
  DEFAULT_PAID_MARKS,
  DEFAULT_PEOPLE,
  DEFAULT_SETTINGS,
  MONTH_KEY_PATTERN,
  choicesSchema,
  paidMarksSchema,
  peopleSchema,
  settingsSchema,
  type PayoutSettings,
  type StoredChoices,
  type StoredPaidMarks,
  type StoredPeople,
} from "./schemas";

const ROOT_FOLDER = "payout";
const MONTHS_FOLDER = `${ROOT_FOLDER}/months`;
const SETTINGS_FILE = `${ROOT_FOLDER}/settings.json`;
const PEOPLE_FILE = `${ROOT_FOLDER}/people.json`;
const CHOICES_FILE = `${ROOT_FOLDER}/choices.json`;
const PAID_MARKS_FILE = `${ROOT_FOLDER}/paid-marks.json`;
const MONTH_FILE_ENDING = ".json";
const JSON_INDENT = 2;
const MAX_ISSUES_SHOWN = 3;
/** The top-level status of a month that is locked. The Rust writer refuses the same files. */
const LOCKED_STATUS = "closed";

// #region Backends
/** Where the text of the files lives. Paths are relative to the app data folder, `/`-separated. */
export interface TextBackend {
  read(path: string): Promise<string | null>;
  write(path: string, text: string): Promise<void>;
  list(folder: string): Promise<string[]>;
}

export interface MemoryBackend extends TextBackend {
  files: Map<string, string>;
}

/** Files kept in a Map; `initialFiles` seeds it (a test puts a broken file there). */
export function createMemoryBackend(initialFiles: Record<string, string> = {}): MemoryBackend {
  const files = new Map(Object.entries(initialFiles));
  return {
    files,
    read: (path) => Promise.resolve(files.get(path) ?? null),
    write: (path, text) => {
      files.set(path, text);
      return Promise.resolve();
    },
    list: (folder) => {
      const prefix = `${folder}/`;
      const names = [...files.keys()]
        .filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes("/"))
        .map((path) => path.slice(prefix.length));
      return Promise.resolve(names.sort());
    },
  };
}

// WHY: the app data module is imported on demand, so a plain browser never loads it.
function createAppDataBackend(): TextBackend {
  return {
    read: async (path) => (await import("../../../lib/appData")).readAppText(path),
    write: async (path, text) => (await import("../../../lib/appData")).writeAppText(path, text),
    list: async (folder) => (await import("../../../lib/appData")).listAppFiles(folder),
  };
}
// #endregion

// #region Parsing
function describeIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, MAX_ISSUES_SHOWN)
    .map((issue) => `${issue.path.join(".") || "(file)"}: ${issue.message}`)
    .join("; ");
}

function parseJson(path: string, text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Cannot read ${path}: it is not valid JSON.`);
  }
}

function versionOf(raw: unknown): number | null {
  if (typeof raw !== "object" || raw === null || !("version" in raw)) return null;
  return typeof raw.version === "number" ? raw.version : null;
}

/** The typed value of a file's text, or a throw that names the file. Never returns a guess. */
function parseFile<T>(path: string, text: string, schema: z.ZodType<T>): T {
  const raw = parseJson(path, text);
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const versionIssue = parsed.error.issues.some((issue) => issue.path[0] === "version");
  const version = versionOf(raw);
  if (versionIssue && version !== null) {
    throw new Error(`Cannot read ${path}: it is version ${version}, which this app does not read.`);
  }
  throw new Error(`Cannot read ${path}: ${describeIssues(parsed.error)}.`);
}

function serializeFile<T>(path: string, value: T, schema: z.ZodType<T>): string {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Cannot write ${path}: ${describeIssues(parsed.error)}.`);
  }
  return `${JSON.stringify(parsed.data, null, JSON_INDENT)}\n`;
}

function monthFilePath(month: string): string {
  if (!MONTH_KEY_PATTERN.test(month)) {
    throw new Error(`Not a month key: "${month}" (expected yyyy-mm).`);
  }
  return `${MONTHS_FOLDER}/${month}${MONTH_FILE_ENDING}`;
}

/** True for the text of a closed month. Like the Rust writer, text that is not JSON is not closed. */
function isClosedText(text: string): boolean {
  try {
    const raw: unknown = JSON.parse(text);
    return (
      typeof raw === "object" && raw !== null && "status" in raw && raw.status === LOCKED_STATUS
    );
  } catch {
    // swallow: text that is not JSON holds no closed month, so the write that follows may replace it
    return false;
  }
}
// #endregion

// #region The store
export interface PayoutStore {
  readSettings(): Promise<PayoutSettings>;
  writeSettings(settings: PayoutSettings): Promise<void>;
  readPeople(): Promise<StoredPeople>;
  writePeople(people: StoredPeople): Promise<void>;
  readChoices(): Promise<StoredChoices>;
  writeChoices(choices: StoredChoices): Promise<void>;
  readPaidMarks(): Promise<StoredPaidMarks>;
  writePaidMarks(marks: StoredPaidMarks): Promise<void>;
  /** The months that have a file, open or closed, oldest first. */
  listMonthKeys(): Promise<string[]>;
  /** The month file parsed with the schema the caller owns, or null when there is none. */
  readMonth<T>(month: string, schema: z.ZodType<T>): Promise<T | null>;
  /** Throws when the stored month is closed: a closed month is written once and never again. */
  writeMonth<T>(month: string, schema: z.ZodType<T>, value: T): Promise<void>;
  /** Marks a person paid for a closed month on a day (yyyy-mm-dd). Throws for a month that is not closed. */
  markPaid(month: string, personId: string, paidOn: string): Promise<void>;
  clearPaid(month: string, personId: string): Promise<void>;
}

/** One file with a default: a missing file gives a fresh copy of the default. */
function fileAccess<T>(backend: TextBackend, path: string, schema: z.ZodType<T>, fallback: T) {
  return {
    read: async (): Promise<T> => {
      const text = await backend.read(path);
      return text === null ? structuredClone(fallback) : parseFile(path, text, schema);
    },
    write: async (value: T): Promise<void> =>
      backend.write(path, serializeFile(path, value, schema)),
  };
}

export function createPayoutStore(backend: TextBackend): PayoutStore {
  const settings = fileAccess(backend, SETTINGS_FILE, settingsSchema, DEFAULT_SETTINGS);
  const people = fileAccess(backend, PEOPLE_FILE, peopleSchema, DEFAULT_PEOPLE);
  const choices = fileAccess(backend, CHOICES_FILE, choicesSchema, DEFAULT_CHOICES);
  const paidMarks = fileAccess(backend, PAID_MARKS_FILE, paidMarksSchema, DEFAULT_PAID_MARKS);
  const readMonthText = (month: string) => backend.read(monthFilePath(month));
  const withoutMark = async (month: string, personId: string) => {
    const stored = await paidMarks.read();
    const marks = stored.marks.filter(
      (mark) => !(mark.month === month && mark.personId === personId),
    );
    return { ...stored, marks };
  };
  return {
    readSettings: settings.read,
    writeSettings: settings.write,
    readPeople: people.read,
    writePeople: people.write,
    readChoices: choices.read,
    writeChoices: choices.write,
    readPaidMarks: paidMarks.read,
    writePaidMarks: paidMarks.write,
    listMonthKeys: async () => {
      const names = await backend.list(MONTHS_FOLDER);
      return names
        .filter((name) => name.endsWith(MONTH_FILE_ENDING))
        .map((name) => name.slice(0, -MONTH_FILE_ENDING.length))
        .filter((key) => MONTH_KEY_PATTERN.test(key))
        .sort();
    },
    readMonth: async (month, schema) => {
      const path = monthFilePath(month);
      const text = await backend.read(path);
      return text === null ? null : parseFile(path, text, schema);
    },
    writeMonth: async (month, schema, value) => {
      const path = monthFilePath(month);
      const text = serializeFile(path, value, schema);
      // WHY: the desktop writer (Rust) refuses this too; the check here gives the memory store
      // the same lock and a message that names the reason.
      const existing = await backend.read(path);
      if (existing !== null && isClosedText(existing)) {
        throw new Error(`Cannot write ${path}: the month is closed and is never written again.`);
      }
      return backend.write(path, text);
    },
    markPaid: async (month, personId, paidOn) => {
      const text = await readMonthText(month);
      if (text === null || !isClosedText(text)) {
        throw new Error(`Only a closed month can be marked as paid, and ${month} is not closed.`);
      }
      const rest = await withoutMark(month, personId);
      await paidMarks.write({ ...rest, marks: [...rest.marks, { month, personId, paidOn }] });
    },
    clearPaid: async (month, personId) => paidMarks.write(await withoutMark(month, personId)),
  };
}

export function createAppDataStore(): PayoutStore {
  return createPayoutStore(createAppDataBackend());
}

export function createMemoryStore(backend: TextBackend = createMemoryBackend()): PayoutStore {
  return createPayoutStore(backend);
}

let sharedStore: PayoutStore | null = null;

/** The one store of the running app: the app data folder in the desktop app, memory in a plain browser. */
export function getPayoutStore(): PayoutStore {
  sharedStore ??= isTauri() ? createAppDataStore() : createMemoryStore();
  return sharedStore;
}
// #endregion
