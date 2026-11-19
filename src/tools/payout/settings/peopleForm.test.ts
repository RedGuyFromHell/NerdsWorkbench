import { describe, expect, it } from "vitest";
import {
  addPerson,
  removePerson,
  renamePerson,
  setPersonAbility,
  setPersonDefault,
  validatePeople,
} from "./peopleForm";

type People = Parameters<typeof validatePeople>[0];

function person(id: string, name: string, overrides: Partial<People[number]> = {}): People[number] {
  return {
    id,
    name,
    prints: false,
    paints: false,
    getsPaid: true,
    defaultFor: [],
    ...overrides,
  };
}

const PRINTER = person("p1", "Printer A", { prints: true });
const PAINTER = person("p2", "Painter B", { paints: true });

describe("addPerson", () => {
  it("adds a blank person with the given id at the end, paid, doing nothing yet", () => {
    const people = addPerson([PRINTER], "new-id");
    expect(people).toEqual([
      PRINTER,
      { id: "new-id", name: "", prints: false, paints: false, getsPaid: true, defaultFor: [] },
    ]);
  });

  it("does not change the list it was given", () => {
    const before: People = [PRINTER];
    addPerson(before, "x");
    expect(before).toEqual([PRINTER]);
  });

  it("refuses an id that is already there", () => {
    expect(() => addPerson([PRINTER], "p1")).toThrow(/p1/);
  });
});

describe("removePerson", () => {
  it("removes a person who is no default", () => {
    expect(removePerson([PRINTER, PAINTER], "p1")).toEqual({ ok: true, people: [PAINTER] });
  });

  it("is refused while the person is a default, and says for which job", () => {
    const printer = person("p1", "Printer A", { prints: true, defaultFor: ["printing"] });
    const result = removePerson([printer, PAINTER], "p1");
    expect(result.ok).toBe(false);
    expect(result.ok ? "" : result.reason).toBe(
      "Printer A is the default for printing. Pick another default first.",
    );
  });

  it("lists every job the person is the default for", () => {
    const painter = person("p2", "Painter B", {
      paints: true,
      defaultFor: ["painting", "drybrush"],
    });
    const result = removePerson([painter], "p2");
    expect(result.ok ? "" : result.reason).toContain("painting and drybrush");
  });

  it("throws for an id that is not in the list", () => {
    expect(() => removePerson([PRINTER], "nobody")).toThrow(/nobody/);
  });
});

describe("setPersonDefault", () => {
  it("makes a person the default for a job they do", () => {
    const people = setPersonDefault([PRINTER, PAINTER], "p1", "printing", true);
    expect(people[0]?.defaultFor).toEqual(["printing"]);
  });

  it("moves the job from the old default, so at most one person holds it", () => {
    const first = person("p1", "Printer A", { prints: true, defaultFor: ["printing"] });
    const second = person("p3", "Printer C", { prints: true });
    const people = setPersonDefault([first, second], "p3", "printing", true);
    expect(people.map((entry) => entry.defaultFor)).toEqual([[], ["printing"]]);
  });

  it("leaves the other jobs of both people alone", () => {
    const first = person("p1", "Printer A", {
      prints: true,
      paints: true,
      defaultFor: ["printing", "painting"],
    });
    const second = person("p3", "Printer C", { prints: true });
    const people = setPersonDefault([first, second], "p3", "printing", true);
    expect(people[0]?.defaultFor).toEqual(["painting"]);
  });

  it("clears the job when switched off", () => {
    const printer = person("p1", "Printer A", { prints: true, defaultFor: ["printing"] });
    expect(setPersonDefault([printer], "p1", "printing", false)[0]?.defaultFor).toEqual([]);
  });

  it("does not list a job twice when asked twice", () => {
    const once = setPersonDefault([PRINTER], "p1", "printing", true);
    expect(setPersonDefault(once, "p1", "printing", true)[0]?.defaultFor).toEqual(["printing"]);
  });

  it("throws when the person does not do that job: the screen never offers it", () => {
    expect(() => setPersonDefault([PRINTER], "p1", "painting", true)).toThrow(/Printer A/);
    expect(() => setPersonDefault([PRINTER], "p1", "drybrush", true)).toThrow(/Printer A/);
  });
});

describe("setPersonAbility", () => {
  it("turns an ability on", () => {
    expect(setPersonAbility([PAINTER], "p2", "prints", true)[0]?.prints).toBe(true);
  });

  it("drops the printing default when printing is turned off", () => {
    const printer = person("p1", "Printer A", { prints: true, defaultFor: ["printing"] });
    const [changed] = setPersonAbility([printer], "p1", "prints", false);
    expect(changed?.prints).toBe(false);
    expect(changed?.defaultFor).toEqual([]);
  });

  it("drops the painting and drybrush defaults when painting is turned off", () => {
    const painter = person("p2", "Painter B", {
      paints: true,
      prints: true,
      defaultFor: ["printing", "painting", "drybrush"],
    });
    expect(setPersonAbility([painter], "p2", "paints", false)[0]?.defaultFor).toEqual(["printing"]);
  });

  it("keeps the defaults when Gets paid changes: an unpaid default is a normal case", () => {
    const owner = person("p2", "Painter B", { paints: true, defaultFor: ["painting"] });
    const [changed] = setPersonAbility([owner], "p2", "getsPaid", false);
    expect(changed?.getsPaid).toBe(false);
    expect(changed?.defaultFor).toEqual(["painting"]);
  });
});

describe("renamePerson", () => {
  it("changes only the name of that person", () => {
    expect(renamePerson([PRINTER, PAINTER], "p2", "Painter Z")).toEqual([
      PRINTER,
      { ...PAINTER, name: "Painter Z" },
    ]);
  });
});

describe("validatePeople", () => {
  it("accepts a list with no problem, and an empty list", () => {
    expect(validatePeople([PRINTER, PAINTER])).toEqual([]);
    expect(validatePeople([])).toEqual([]);
  });

  it("asks for a name, by the position of the person", () => {
    expect(validatePeople([PRINTER, person("p2", "   ")])).toEqual(["Person 2 has no name."]);
  });

  it("refuses two people with the same name, whatever the case and spaces", () => {
    expect(validatePeople([PRINTER, person("p2", " printer  a ", { paints: true })])).toEqual([
      'Two people are named "Printer A". Names must differ.',
    ]);
  });

  it("refuses two defaults for one job, naming both", () => {
    const first = person("p1", "Printer A", { prints: true, defaultFor: ["printing"] });
    const second = person("p3", "Printer C", { prints: true, defaultFor: ["printing"] });
    expect(validatePeople([first, second])).toEqual([
      "Printer A and Printer C are both the default for printing. Only one person can be.",
    ]);
  });

  it("refuses a default for a job the person does not do", () => {
    const printer = person("p1", "Printer A", { prints: true, defaultFor: ["drybrush"] });
    expect(validatePeople([printer])).toEqual([
      "Printer A is the default for drybrush but does not paint.",
    ]);
  });

  it("reports every problem, not only the first", () => {
    expect(validatePeople([person("p1", ""), person("p2", "")])).toHaveLength(2);
  });
});
