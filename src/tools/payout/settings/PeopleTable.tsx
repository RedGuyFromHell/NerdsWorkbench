import { useState } from "react";
import { Button } from "../../../ui/Button";
import { Checkbox } from "../../../ui/Checkbox";
import type { PersonJob } from "../storage/schemas";
import {
  addPerson,
  jobsOf,
  removePerson,
  renamePerson,
  setPersonAbility,
  setPersonDefault,
  type PersonAbility,
  type StoredPerson,
} from "./peopleForm";

interface PeopleTableProps {
  people: StoredPerson[];
  onChange(people: StoredPerson[]): void;
}

const ALL_JOBS: readonly { job: PersonJob; label: string }[] = [
  { job: "printing", label: "Printing" },
  { job: "painting", label: "Painting" },
  { job: "drybrush", label: "Drybrush" },
];

const ABILITIES: readonly { ability: PersonAbility; label: string }[] = [
  { ability: "prints", label: "Prints" },
  { ability: "paints", label: "Paints" },
  { ability: "getsPaid", label: "Gets paid" },
];

function whoIs(person: StoredPerson, index: number): string {
  return person.name.trim() === "" ? `person ${index + 1}` : person.name.trim();
}

export function PeopleTable({ people, onChange }: PeopleTableProps) {
  const [refusal, setRefusal] = useState("");

  function remove(personId: string) {
    const result = removePerson(people, personId);
    setRefusal(result.ok ? "" : result.reason);
    if (result.ok) onChange(result.people);
  }

  return (
    <>
      {people.length === 0 ? (
        <p className="payout-settings__hint">No one yet. Add the people the tool pays.</p>
      ) : (
        <table className="payout-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              {ABILITIES.map(({ ability, label }) => (
                <th key={ability} scope="col">
                  {label}
                </th>
              ))}
              <th scope="col">Default for</th>
              <th scope="col">
                <span className="payout-table__sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map((person, index) => (
              <tr key={person.id}>
                <td>
                  <input
                    type="text"
                    className="input payout-table__name"
                    aria-label={`Name, person ${index + 1}`}
                    value={person.name}
                    onChange={(event) =>
                      onChange(renamePerson(people, person.id, event.target.value))
                    }
                  />
                </td>
                {ABILITIES.map(({ ability, label }) => (
                  <td key={ability}>
                    <Checkbox
                      boxOnly
                      label={`${label}, ${whoIs(person, index)}`}
                      checked={person[ability]}
                      onChange={(value) =>
                        onChange(setPersonAbility(people, person.id, ability, value))
                      }
                    />
                    {ability === "getsPaid" && !person.getsPaid ? (
                      <span className="payout-settings__hint"> money stays in the company</span>
                    ) : null}
                  </td>
                ))}
                <td>
                  <div
                    className="payout-table__defaults"
                    role="group"
                    aria-label={`Default for, ${whoIs(person, index)}`}
                  >
                    {ALL_JOBS.map(({ job, label }) => (
                      <Checkbox
                        key={job}
                        label={label}
                        checked={person.defaultFor.includes(job)}
                        disabled={!jobsOf(person).includes(job)}
                        onChange={(value) =>
                          onChange(setPersonDefault(people, person.id, job, value))
                        }
                      />
                    ))}
                  </div>
                </td>
                <td>
                  <Button
                    aria-label={`Remove ${whoIs(person, index)}`}
                    onClick={() => remove(person.id)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {refusal === "" ? null : (
        <p role="alert" className="payout-settings__problem">
          {refusal}
        </p>
      )}
      <div>
        <Button onClick={() => onChange(addPerson(people, crypto.randomUUID()))}>
          + Add person
        </Button>
      </div>
    </>
  );
}
