// Who printed and who painted each line: the defaults from Settings, the choice remembered per
// product, the menus' lists, a change of one choice, and the merge of a fresh load over an open
// month. Pure. A choice is a person id, or null when it is not made yet. A choice that points at a
// person no longer in Settings counts as no choice.

import type { MonthLine } from "../storage/monthSchema";
import type { PersonJob, StoredChoices, StoredPeople } from "../storage/schemas";
import type { LineChoice } from "./monthLines";
import type { PaintOption } from "./types";

type StoredPerson = StoredPeople["people"][number];

/** The two menus of a line. */
export type ChoicePart = keyof LineChoice;

export interface MenuOption {
  value: string;
  label: string;
}

/** The empty value of a menu: no person chosen. */
export const NO_PERSON = "";
const NO_PERSON_LABEL = "Choose...";
const UNNAMED_LABEL = "(no name)";

const ABILITY_OF_PART = { printedBy: "prints", paintedBy: "paints" } as const;
const VERB_OF_PART = { printedBy: "print", paintedBy: "paint" } as const;

/** The default job a menu starts from, by the paint option of the line. */
const JOB_OF_PAINT_OPTION: Record<PaintOption, PersonJob | null> = {
  none: null,
  primed: "drybrush",
  partial: "painting",
  complete: "painting",
};

interface ChoiceSubject {
  productId: string | null;
  facts: { paintOption: PaintOption };
}

function findPerson(people: readonly StoredPerson[], personId: string | null) {
  return people.find((person) => person.id === personId);
}

/** The person if they are in Settings and do the job of the menu (Prints for Printed by). */
function pickablePerson(
  part: ChoicePart,
  personId: string | null,
  people: readonly StoredPerson[],
): string | null {
  const person = findPerson(people, personId);
  return person?.[ABILITY_OF_PART[part]] === true ? person.id : null;
}

function holderOfDefault(
  job: PersonJob,
  people: readonly StoredPerson[],
): StoredPerson | undefined {
  return people.find((person) => person.defaultFor.includes(job));
}

function settingsDefault(
  part: ChoicePart,
  subject: ChoiceSubject,
  people: readonly StoredPerson[],
): string | null {
  const job = part === "printedBy" ? "printing" : JOB_OF_PAINT_OPTION[subject.facts.paintOption];
  if (job === null) return null;
  return pickablePerson(part, holderOfDefault(job, people)?.id ?? null, people);
}

/**
 * The two choices a new line starts with: what was last picked for its product, else the Settings
 * default for the job. A line with no paint option has no painter.
 */
export function defaultChoices(
  subject: ChoiceSubject,
  people: readonly StoredPerson[],
  remembered: StoredChoices,
): LineChoice {
  const memory = subject.productId === null ? undefined : remembered.byProduct[subject.productId];
  const choose = (part: ChoicePart): string | null =>
    pickablePerson(part, memory?.[part] ?? null, people) ?? settingsDefault(part, subject, people);
  return {
    printedBy: choose("printedBy"),
    paintedBy: subject.facts.paintOption === "none" ? null : choose("paintedBy"),
  };
}

/** The remembered choices with one more pick. A line with no product is not remembered. */
export function rememberChoice(
  remembered: StoredChoices,
  productId: string | null,
  part: ChoicePart,
  personId: string | null,
): StoredChoices {
  if (productId === null) return remembered;
  const before = remembered.byProduct[productId] ?? { printedBy: null, paintedBy: null };
  return {
    ...remembered,
    byProduct: { ...remembered.byProduct, [productId]: { ...before, [part]: personId } },
  };
}

/** The lines with one choice changed on one line. A painter on a line with no paint is refused. */
export function applyChoice(
  lines: readonly MonthLine[],
  lineId: string,
  part: ChoicePart,
  personId: string | null,
): MonthLine[] {
  if (!lines.some((line) => line.lineId === lineId)) {
    throw new Error(`No line with id "${lineId}".`);
  }
  return lines.map((line) => {
    if (line.lineId !== lineId) return line;
    if (part === "paintedBy" && line.facts.paintOption === "none") return line;
    return { ...line, [part]: personId };
  });
}

/** The people a menu lists, in the order of Settings: Prints for Printed by, Paints for Painted by. */
export function peopleForMenu(part: ChoicePart, people: readonly StoredPerson[]): StoredPerson[] {
  return people.filter((person) => person[ABILITY_OF_PART[part]]);
}

function labelOf(person: StoredPerson): string {
  return person.name === "" ? UNNAMED_LABEL : person.name;
}

/**
 * The options of one menu: the empty choice, then the people who do the job. A chosen person who
 * does not do it now stays in the list so the menu shows the truth; a removed person does not.
 */
export function menuOptions(
  part: ChoicePart,
  chosen: string | null,
  people: readonly StoredPerson[],
): MenuOption[] {
  const listed = peopleForMenu(part, people);
  const options = [
    { value: NO_PERSON, label: NO_PERSON_LABEL },
    ...listed.map((person) => ({ value: person.id, label: labelOf(person) })),
  ];
  const kept = findPerson(people, chosen);
  if (kept !== undefined && !listed.includes(kept)) {
    options.push({
      value: kept.id,
      label: `${labelOf(kept)} (does not ${VERB_OF_PART[part]} now)`,
    });
  }
  return options;
}

/** The menus of a line that are empty (or hold a removed person) and need one. */
export function listMissingChoices(
  line: Pick<MonthLine, "printedBy" | "paintedBy" | "facts">,
  people: readonly StoredPerson[],
): ChoicePart[] {
  const missing: ChoicePart[] = [];
  if (findPerson(people, line.printedBy) === undefined) missing.push("printedBy");
  const hasPainter = line.facts.paintOption !== "none";
  if (hasPainter && findPerson(people, line.paintedBy) === undefined) missing.push("paintedBy");
  return missing;
}

/**
 * A fresh load over an open month. The fresh lines come with their defaults already; a line that
 * was there keeps its own choices (by line id), unless they point at a removed person.
 * Lines gone from the fresh load are gone.
 */
export function mergeReload(
  oldLines: readonly MonthLine[],
  freshLines: readonly MonthLine[],
  people: readonly StoredPerson[],
): MonthLine[] {
  const oldById = new Map(oldLines.map((line) => [line.lineId, line]));
  const keep = (part: ChoicePart, old: MonthLine | undefined, fresh: MonthLine): string | null => {
    const earlier = old?.[part] ?? null;
    return findPerson(people, earlier) === undefined ? fresh[part] : earlier;
  };
  return freshLines.map((fresh) => {
    const old = oldById.get(fresh.lineId);
    if (old === undefined) return fresh;
    const painted = fresh.facts.paintOption === "none" ? null : keep("paintedBy", old, fresh);
    return { ...fresh, printedBy: keep("printedBy", old, fresh), paintedBy: painted };
  });
}

/** The part of the month view that blockingLines reads. */
interface BlockableView {
  orders: readonly {
    lines: readonly { status: "ok" | "blocked"; missingChoices: readonly ChoicePart[] }[];
  }[];
}

export interface BlockingLines {
  blocked: number;
  needsChoice: number;
  /** Lines that are either: one that is both counts once. */
  total: number;
}

/** The lines that keep the month from closing: blocked by the maths, or with a menu still empty. */
export function blockingLines(view: BlockableView): BlockingLines {
  const rows = view.orders.flatMap((order) => order.lines);
  const blocked = rows.filter((row) => row.status === "blocked").length;
  const needsChoice = rows.filter((row) => row.missingChoices.length > 0).length;
  const total = rows.filter(
    (row) => row.status === "blocked" || row.missingChoices.length > 0,
  ).length;
  return { blocked, needsChoice, total };
}
