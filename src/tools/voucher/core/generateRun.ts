// One GENERATE! run, in the order that leaves the clearest state when something fails: the codes,
// the codes file, the discount with the first code, the other codes in batches, then the images.
// Everything outside the process (Shopify, the disk, the canvas, the clock) comes in as a
// parameter, so the tests run the real order against stand-ins.
import { z } from "zod";
import { errorText } from "../../../lib/shopify/client";
import { safeFileName } from "../../../lib/files";
import { planCodeBatches } from "../shopify/codeBatches";
import { buildDiscountInput, buildDiscountTitle } from "../shopify/discountInput";
import type { GraphqlCall } from "../shopify/listCollections";
import { generateCodes, type RandomIndex } from "./codeGen";
import { getOutputFileName, type OutputFile } from "./outputFile";
import type { VoucherSettings } from "./voucherSettings";

export type GenerateProgress =
  | { stage: "codes" }
  | { stage: "discount" }
  | { stage: "addingCodes"; added: number; total: number }
  | { stage: "images"; written: number; total: number };

export interface GenerateRunRequest {
  settings: VoucherSettings;
  /** The format of the images, from the template's extension. */
  output: OutputFile;
}

export interface GenerateRunDeps {
  graphql: GraphqlCall;
  /** Writes the bytes to the path, replacing what is there. */
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  /** The finished voucher image for one code, encoded in the request's output format. */
  renderImage(code: string): Promise<Uint8Array>;
  onProgress(progress: GenerateProgress): void;
  /** Read between two images only: the Shopify part is never left half done on purpose. */
  signal: AbortSignal;
  sleep(milliseconds: number): Promise<void>;
  /** For the tests; the default is the system's secure generator. */
  randomIndex?: RandomIndex;
}

export interface GenerateOutcome {
  /** True when the abort signal stopped the images. The discount and every code exist all the same. */
  aborted: boolean;
  codesPath: string;
  discountTitle: string;
  codeCount: number;
  imagesWritten: number;
}

/** A failed run. The message says what exists in Shopify and on disk, so the user knows what to clean up. */
export class GenerateRunError extends Error {
  readonly discountCreated: boolean;
  /** Null when the codes file was not written. */
  readonly codesPath: string | null;

  constructor(message: string, state: RunState, cause: unknown) {
    super(message, { cause });
    this.name = "GenerateRunError";
    this.discountCreated = state.discountTitle !== null;
    this.codesPath = state.codesPath;
  }
}

/** How far the run got: what a failure message is built from. */
interface RunState {
  codeCount: number;
  codesPath: string | null;
  /** Null until the discount exists in Shopify. */
  discountTitle: string | null;
  codesInShopify: number;
  /** False after a batch Shopify had not finished: more codes may have landed since the last look. */
  codesCountIsExact: boolean;
  /** Null until the image stage starts. */
  imagesWritten: number | null;
}

const CODES_FILE_NAME = "codes.csv";
const CODES_CSV_HEADER = "code";
const DAY_START_UTC = "T00:00:00Z";
const DAY_END_UTC = "T23:59:59Z";
const BULK_ADD_POLL_DELAY_MS = 1000;
const BULK_ADD_MAX_POLLS = 120;
const IMAGE_PROGRESS_STEP = 10;

// #region The run
export async function runGenerate(
  request: GenerateRunRequest,
  deps: GenerateRunDeps,
): Promise<GenerateOutcome> {
  const state: RunState = {
    codeCount: request.settings.voucherCount,
    codesPath: null,
    discountTitle: null,
    codesInShopify: 0,
    codesCountIsExact: true,
    imagesWritten: null,
  };
  try {
    return await runStages(request, deps, state);
  } catch (error) {
    throw new GenerateRunError(describeFailure(asSentence(errorText(error)), state), state, error);
  }
}

async function runStages(
  { settings, output }: GenerateRunRequest,
  deps: GenerateRunDeps,
  state: RunState,
): Promise<GenerateOutcome> {
  deps.onProgress({ stage: "codes" });
  const codes = generateCodes(
    {
      prefix: settings.prefix,
      length: settings.randomLength,
      count: settings.voucherCount,
      numbersOnly: settings.numbersOnly,
    },
    deps.randomIndex,
  );
  const { firstCode, remainingBatches } = planCodeBatches(codes);

  // WHY: the file goes down before any Shopify call. Shopify cannot list a discount's codes in
  // one go, so codes that exist there and nowhere on disk would be lost.
  const codesPath = pathInFolder(settings.savePath, CODES_FILE_NAME);
  await deps.writeFile(codesPath, new TextEncoder().encode(formatCodesCsv(codes)));
  state.codesPath = codesPath;

  deps.onProgress({ stage: "discount" });
  const discountTitle = buildDiscountTitle(settings.prefix);
  const discountId = await createDiscount(deps.graphql, settings, discountTitle, firstCode);
  state.discountTitle = discountTitle;
  state.codesInShopify = 1;
  await addRemainingCodes(discountId, remainingBatches, deps, state);

  state.imagesWritten = 0;
  const aborted = await writeImages(codes, { settings, output }, deps, state);
  return {
    aborted,
    codesPath,
    discountTitle,
    codeCount: codes.length,
    imagesWritten: state.imagesWritten,
  };
}

/** Resolves true when the abort signal stopped it before the last image. */
async function writeImages(
  codes: readonly string[],
  { settings, output }: GenerateRunRequest,
  deps: GenerateRunDeps,
  state: RunState,
): Promise<boolean> {
  const total = codes.length;
  deps.onProgress({ stage: "images", written: 0, total });
  for (const [index, code] of codes.entries()) {
    if (deps.signal.aborted) return true;
    // WHY: a code may hold characters a file name cannot ("/", ":"), or ".." that would climb
    // out of the save folder. The code itself is untouched; only its file name is made safe.
    const fileName = getOutputFileName(safeFileName(code), output);
    await deps.writeFile(pathInFolder(settings.savePath, fileName), await deps.renderImage(code));
    const written = index + 1;
    state.imagesWritten = written;
    if (written % IMAGE_PROGRESS_STEP === 0 || written === total) {
      deps.onProgress({ stage: "images", written, total });
    }
  }
  return false;
}
// #endregion

// #region Shopify calls
const userErrorsSchema = z.array(
  z.object({ field: z.array(z.string()).nullish(), message: z.string() }),
);

const CREATE_DISCOUNT_MUTATION = `
  mutation CreateDiscount($input: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $input) {
      codeDiscountNode { id }
      userErrors { field message }
    }
  }
`;

const createDiscountSchema = z.object({
  discountCodeBasicCreate: z.object({
    codeDiscountNode: z.object({ id: z.string() }).nullable(),
    userErrors: userErrorsSchema,
  }),
});

// WHY: this mutation only queues the codes. Shopify creates them in the background and reports
// through the `bulkCreation` it returns, so each batch is followed until it is done.
const BULK_ADD_MUTATION = `
  mutation BulkAddCodes($discountId: ID!, $codes: [DiscountRedeemCodeInput!]!) {
    discountRedeemCodeBulkAdd(discountId: $discountId, codes: $codes) {
      bulkCreation { id }
      userErrors { field message }
    }
  }
`;

const bulkAddSchema = z.object({
  discountRedeemCodeBulkAdd: z.object({
    bulkCreation: z.object({ id: z.string() }).nullable(),
    userErrors: userErrorsSchema,
  }),
});

const BULK_CREATION_QUERY = `
  query BulkCreation($id: ID!) {
    discountRedeemCodeBulkCreation(id: $id) { done importedCount failedCount }
  }
`;

const bulkCreationSchema = z.object({
  discountRedeemCodeBulkCreation: z.object({
    done: z.boolean(),
    importedCount: z.number(),
    failedCount: z.number(),
  }),
});

type BulkCreation = z.infer<typeof bulkCreationSchema>["discountRedeemCodeBulkCreation"];

function throwOnUserErrors(action: string, userErrors: z.infer<typeof userErrorsSchema>): void {
  if (userErrors.length === 0) return;
  const reasons = userErrors.map(({ field, message }) =>
    field && field.length > 0 ? `${field.join(".")}: ${message}` : message,
  );
  throw new Error(`${action} failed: ${reasons.join("; ")}`);
}

/** Creates the discount with its first code and returns the discount's id. */
async function createDiscount(
  graphql: GraphqlCall,
  settings: VoucherSettings,
  title: string,
  firstCode: string,
): Promise<string> {
  const input = buildDiscountInput({
    title,
    firstCode,
    percentage: settings.percentage,
    appliesTo: settings.appliesTo,
    collectionIds: settings.collectionIds,
    minimumSubtotal: settings.minimumSubtotal,
    usageLimit: settings.usageLimit,
    oncePerCustomer: settings.oncePerCustomer,
    // WHY: the dates go as whole UTC days, as the old app sent them, so a voucher made here
    // starts and ends at the same moments as one made there.
    startsAt: `${settings.startDate}${DAY_START_UTC}`,
    endsAt: `${settings.endDate}${DAY_END_UTC}`,
  });
  const { discountCodeBasicCreate } = await graphql(
    CREATE_DISCOUNT_MUTATION,
    { input },
    createDiscountSchema,
  );
  throwOnUserErrors("Discount creation", discountCodeBasicCreate.userErrors);
  if (discountCodeBasicCreate.codeDiscountNode === null) {
    throw new Error("Discount creation failed: Shopify returned no discount.");
  }
  return discountCodeBasicCreate.codeDiscountNode.id;
}

async function addRemainingCodes(
  discountId: string,
  batches: readonly string[][],
  deps: GenerateRunDeps,
  state: RunState,
): Promise<void> {
  const total = state.codeCount;
  deps.onProgress({ stage: "addingCodes", added: state.codesInShopify, total });
  for (const [index, batch] of batches.entries()) {
    const batchLabel = `batch ${index + 1} of ${batches.length}`;
    const creation = await addCodeBatch(discountId, batch, deps);
    state.codesInShopify += creation.importedCount;
    if (!creation.done) {
      state.codesCountIsExact = false;
      const waitSeconds = (BULK_ADD_MAX_POLLS * BULK_ADD_POLL_DELAY_MS) / 1000;
      throw new Error(`Shopify did not finish adding ${batchLabel} within ${waitSeconds} seconds.`);
    }
    if (creation.failedCount > 0) {
      throw new Error(
        `Shopify refused ${creation.failedCount} of the ${batch.length} codes in ${batchLabel}.`,
      );
    }
    deps.onProgress({ stage: "addingCodes", added: state.codesInShopify, total });
  }
}

/** Queues one batch and follows it. Returns the last state seen: `done` is false after the bounded wait ran out. */
async function addCodeBatch(
  discountId: string,
  batch: readonly string[],
  deps: GenerateRunDeps,
): Promise<BulkCreation> {
  const { discountRedeemCodeBulkAdd } = await deps.graphql(
    BULK_ADD_MUTATION,
    { discountId, codes: batch.map((code) => ({ code })) },
    bulkAddSchema,
  );
  throwOnUserErrors("Code creation", discountRedeemCodeBulkAdd.userErrors);
  if (discountRedeemCodeBulkAdd.bulkCreation === null) {
    throw new Error("Code creation failed: Shopify did not start the batch.");
  }
  const { id } = discountRedeemCodeBulkAdd.bulkCreation;

  let creation: BulkCreation = { done: false, importedCount: 0, failedCount: 0 };
  for (let poll = 0; poll < BULK_ADD_MAX_POLLS && !creation.done; poll += 1) {
    await deps.sleep(BULK_ADD_POLL_DELAY_MS);
    const answer = await deps.graphql(BULK_CREATION_QUERY, { id }, bulkCreationSchema);
    creation = answer.discountRedeemCodeBulkCreation;
  }
  return creation;
}
// #endregion

// #region Files and messages
/** One code per line under a header. A code with a comma, a quote or a line break is quoted. */
export function formatCodesCsv(codes: readonly string[]): string {
  const lines = codes.map((code) =>
    /[",\r\n]/.test(code) ? `"${code.replaceAll('"', '""')}"` : code,
  );
  return `${[CODES_CSV_HEADER, ...lines].join("\n")}\n`;
}

/** The file's path inside the folder, joined with the separator the folder's own path uses. */
function pathInFolder(folder: string, fileName: string): string {
  if (/[\\/]$/.test(folder)) return `${folder}${fileName}`;
  const separator = folder.includes("\\") ? "\\" : "/";
  return `${folder}${separator}${fileName}`;
}

function asSentence(text: string): string {
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/** What the screen shows while the run is at this step. */
export function formatGenerateProgress(progress: GenerateProgress): string {
  switch (progress.stage) {
    case "codes":
      return "Generating unique codes…";
    case "discount":
      return "Creating Shopify discount…";
    case "addingCodes":
      return `Adding codes to Shopify: ${progress.added} of ${progress.total}`;
    case "images":
      return `Rendering voucher images: ${progress.written} of ${progress.total}`;
  }
}

function describeFailure(cause: string, state: RunState): string {
  const { codeCount, codesPath, discountTitle } = state;
  if (discountTitle === null || codesPath === null) {
    const nothingCreated = `${cause} Nothing was created in Shopify.`;
    if (codesPath === null) return nothingCreated;
    return `${nothingCreated} The codes in ${codesPath} do not exist there: delete that file.`;
  }
  const atLeast = state.codesCountIsExact ? "" : "at least ";
  const reached =
    state.imagesWritten === null
      ? `${atLeast}${state.codesInShopify} of ${codeCount} codes`
      : `all ${codeCount} codes, but only ${state.imagesWritten} of ${codeCount} images were written`;
  return (
    `${cause} The discount "${discountTitle}" exists in Shopify with ${reached}. ` +
    `Every code is listed in ${codesPath}. ` +
    "Delete the discount in Shopify admin before you generate again."
  );
}
// #endregion
