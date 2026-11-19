// What one change of a menu writes: the month file with the new choice, then the choice
// remembered for the product. Through the store only, never the files directly.
import { rememberChoice } from "./core/choices";
import type { ChoicePart } from "./core/choices";
import { monthFileSchema } from "./storage/monthSchema";
import type { MonthFile } from "./storage/monthSchema";
import type { PayoutStore } from "./storage/payoutStore";

/** `next` is the whole month file with the choice already applied. */
export async function saveChoice(
  store: PayoutStore,
  next: MonthFile,
  productId: string | null,
  part: ChoicePart,
  personId: string | null,
): Promise<void> {
  await store.writeMonth(next.month, monthFileSchema, next);
  const remembered = await store.readChoices();
  await store.writeChoices(rememberChoice(remembered, productId, part, personId));
}
