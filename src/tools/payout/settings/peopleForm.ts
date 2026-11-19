// The people list of Settings › Payout: adding, removing, the abilities of a person, and the
// rule that each job has at most one default person. Every function returns a new list.
import { toMatchKey } from "../core/matchText";
import type { PersonJob, StoredPeople } from "../storage/schemas";

export type StoredPerson = StoredPeople["people"][number];
export type PersonAbility = "prints" | "paints" | "getsPaid";

export type RemoveResult = { ok: true; people: StoredPerson[] } | { ok: false; reason: string };

/** The ability a person needs to be the default for a job. A primed line's drybrush is painter's work. */
const ABILITY_OF_JOB: Record<PersonJob, "prints" | "paints"> = {
  printing: "prints",
  painting: "paints",
  drybrush: "paints",
};

const VERB_OF_ABILITY = { prints: "print", paints: "paint" } as const;

function findPerson(people: readonly StoredPerson[], personId: string): StoredPerson {
  const found = people.find((person) => person.id === personId);
  if (found === undefined) throw new Error(`No person with id "${personId}".`);
  return found;
}

function changePerson(
  people: readonly StoredPerson[],
  personId: string,
  change: (person: StoredPerson) => StoredPerson,
): StoredPerson[] {
  findPerson(people, personId);
  return people.map((person) => (person.id === personId ? change(person) : person));
}

/** The jobs a person may be the default for, given what they do. */
export function jobsOf(person: Pick<StoredPerson, "prints" | "paints">): PersonJob[] {
  return (Object.keys(ABILITY_OF_JOB) as PersonJob[]).filter((job) => person[ABILITY_OF_JOB[job]]);
}

/** A new blank person at the end of the list. The caller makes the id (`crypto.randomUUID()`). */
export function addPerson(people: readonly StoredPerson[], id: string): StoredPerson[] {
  if (people.some((person) => person.id === id)) throw new Error(`Person id "${id}" is taken.`);
  const blank: StoredPerson = {
    id,
    name: "",
    prints: false,
    paints: false,
    getsPaid: true,
    defaultFor: [],
  };
  return [...people, blank];
}

function joinWithAnd(words: readonly string[]): string {
  return words.join(" and ");
}

/** Refused while the person is a default: the menus would lose their default without anyone choosing. */
export function removePerson(people: readonly StoredPerson[], personId: string): RemoveResult {
  const person = findPerson(people, personId);
  if (person.defaultFor.length > 0) {
    const reason = `${person.name} is the default for ${joinWithAnd(person.defaultFor)}. Pick another default first.`;
    return { ok: false, reason };
  }
  return { ok: true, people: people.filter((other) => other.id !== personId) };
}

export function renamePerson(
  people: readonly StoredPerson[],
  personId: string,
  name: string,
): StoredPerson[] {
  return changePerson(people, personId, (person) => ({ ...person, name }));
}

/** Turning printing or painting off also drops the defaults that needed it. */
export function setPersonAbility(
  people: readonly StoredPerson[],
  personId: string,
  ability: PersonAbility,
  value: boolean,
): StoredPerson[] {
  return changePerson(people, personId, (person) => {
    const changed = { ...person, [ability]: value };
    return {
      ...changed,
      defaultFor: changed.defaultFor.filter((job) => jobsOf(changed).includes(job)),
    };
  });
}

/** Switching a job on moves it from its old default, so at most one person holds it. */
export function setPersonDefault(
  people: readonly StoredPerson[],
  personId: string,
  job: PersonJob,
  value: boolean,
): StoredPerson[] {
  const target = findPerson(people, personId);
  if (value && !jobsOf(target).includes(job)) {
    throw new Error(
      `${target.name} does not ${VERB_OF_ABILITY[ABILITY_OF_JOB[job]]}, so cannot be the default for ${job}.`,
    );
  }
  return people.map((person) => {
    const others = person.defaultFor.filter((held) => held !== job);
    const holds = person.id === personId && value;
    return { ...person, defaultFor: holds ? [...others, job] : others };
  });
}

// #region Validation
function listBlankNames(people: readonly StoredPerson[]): string[] {
  return people.flatMap((person, index) =>
    toMatchKey(person.name) === "" ? [`Person ${index + 1} has no name.`] : [],
  );
}

function listRepeatedNames(people: readonly StoredPerson[]): string[] {
  const named = people.filter((person) => toMatchKey(person.name) !== "");
  const firstSpelling = new Map<string, string>();
  const repeated = new Set<string>();
  for (const person of named) {
    const key = toMatchKey(person.name);
    if (firstSpelling.has(key)) repeated.add(key);
    else firstSpelling.set(key, person.name.trim());
  }
  return [...repeated]
    .map((key) => firstSpelling.get(key) ?? key)
    .map((name) => `Two people are named "${name}". Names must differ.`);
}

function listCrowdedDefaults(people: readonly StoredPerson[]): string[] {
  return (Object.keys(ABILITY_OF_JOB) as PersonJob[]).flatMap((job) => {
    const holders = people.filter((person) => person.defaultFor.includes(job));
    if (holders.length < 2) return [];
    const names = joinWithAnd(holders.map((person) => person.name));
    return [`${names} are both the default for ${job}. Only one person can be.`];
  });
}

function listImpossibleDefaults(people: readonly StoredPerson[]): string[] {
  return people.flatMap((person) =>
    person.defaultFor
      .filter((job) => !jobsOf(person).includes(job))
      .map(
        (job) =>
          `${person.name} is the default for ${job} but does not ${VERB_OF_ABILITY[ABILITY_OF_JOB[job]]}.`,
      ),
  );
}

/** Every problem that must be fixed before the people are saved. An empty list means fine. */
export function validatePeople(people: readonly StoredPerson[]): string[] {
  return [
    ...listBlankNames(people),
    ...listRepeatedNames(people),
    ...listCrowdedDefaults(people),
    ...listImpossibleDefaults(people),
  ];
}
// #endregion
