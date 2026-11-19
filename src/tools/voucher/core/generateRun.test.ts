import { describe, expect, it } from "vitest";
import type { GraphqlCall } from "../../../lib/shopify/client";
import type { RandomIndex } from "./codeGen";
import {
  formatGenerateProgress,
  GenerateRunError,
  runGenerate,
  type GenerateProgress,
  type GenerateRunDeps,
} from "./generateRun";
import { getOutputFile } from "./outputFile";
import { defaultVoucherSettings, type VoucherSettings } from "./voucherSettings";

const DISCOUNT_ID = "gid://shopify/DiscountCodeNode/1";
const SAVE_FOLDER = "D:\\vouchers";
const RUN_STARTED = new Date(2026, 10, 19, 14, 30, 5);
const CODES_PATH = "D:\\vouchers\\codes-T-20261119-143005.csv";

interface BulkAnswer {
  /** Poll answers for one batch, in order; the last one repeats. */
  polls?: { done: boolean; importedCount: number; failedCount: number }[];
  userErrors?: { field: string[] | null; message: string }[];
}

interface FakeOptions {
  createUserErrors?: { field: string[] | null; message: string }[];
  /** One entry per bulk-add call; a missing entry imports the whole batch on the first poll. */
  bulkAnswers?: BulkAnswer[];
  /** The create call rejects with this, as a lost connection or a GraphQL error does. */
  createFailure?: Error;
  /** Shopify answers the create call with no discount and no user error. */
  createGivesNoDiscount?: boolean;
  /** The bulk-add call of this index (0 is the first batch) rejects with the error. */
  addFailure?: { batchIndex: number; error: Error };
  /** Every poll of this bulk creation id rejects with the error. */
  pollFailure?: { id: string; error: Error };
  failWriteOf?: string;
  failImageOf?: string;
  abortAfterImages?: number;
}

/** Stand-ins for everything outside the process. Every call lands in `events`, in order. */
function makeFakes(options: FakeOptions = {}) {
  const events: string[] = [];
  const files = new Map<string, Uint8Array>();
  const createInputs: Record<string, unknown>[] = [];
  const batches: string[][] = [];
  const sleeps: number[] = [];
  const progress: GenerateProgress[] = [];
  const abort = new AbortController();
  const pollCounts = new Map<string, number>();
  let imagesRendered = 0;

  const answer = (query: string, variables: Record<string, unknown>): unknown => {
    if (query.includes("discountCodeBasicCreate")) {
      events.push("create");
      createInputs.push(variables.input as Record<string, unknown>);
      if (options.createFailure) throw options.createFailure;
      const userErrors = options.createUserErrors ?? [];
      const noDiscount = userErrors.length > 0 || options.createGivesNoDiscount === true;
      return {
        discountCodeBasicCreate: {
          codeDiscountNode: noDiscount ? null : { id: DISCOUNT_ID },
          userErrors,
        },
      };
    }
    if (query.includes("discountRedeemCodeBulkAdd")) {
      const codes = (variables.codes as { code: string }[]).map((entry) => entry.code);
      events.push(`add:${codes.length}`);
      expect(variables.discountId).toBe(DISCOUNT_ID);
      if (options.addFailure?.batchIndex === batches.length) throw options.addFailure.error;
      const userErrors = options.bulkAnswers?.[batches.length]?.userErrors ?? [];
      batches.push(codes);
      return {
        discountRedeemCodeBulkAdd: {
          bulkCreation: userErrors.length > 0 ? null : { id: `bulk-${batches.length}` },
          userErrors,
        },
      };
    }
    if (query.includes("discountRedeemCodeBulkCreation")) {
      const id = String(variables.id);
      const batchIndex = Number(id.replace("bulk-", "")) - 1;
      const pollIndex = pollCounts.get(id) ?? 0;
      pollCounts.set(id, pollIndex + 1);
      events.push(`poll:${id}`);
      if (options.pollFailure?.id === id) throw options.pollFailure.error;
      const polls = options.bulkAnswers?.[batchIndex]?.polls ?? [
        { done: true, importedCount: batches[batchIndex]?.length ?? 0, failedCount: 0 },
      ];
      return { discountRedeemCodeBulkCreation: polls[Math.min(pollIndex, polls.length - 1)] };
    }
    throw new Error(`The fake does not know this query: ${query}`);
  };

  // WHY: a throw inside the answer becomes a rejected call, as a real failed request is.
  const graphql: GraphqlCall = (query, variables, schema) =>
    new Promise((resolve) => {
      resolve(schema.parse(answer(query, variables)));
    });

  const deps: GenerateRunDeps = {
    graphql,
    writeFile(path, bytes) {
      events.push(`write:${path}`);
      if (path === options.failWriteOf) return Promise.reject(new Error("The disk is full."));
      files.set(path, bytes);
      return Promise.resolve();
    },
    renderImage(code) {
      events.push(`render:${code}`);
      if (code === options.failImageOf) return Promise.reject(new Error("The canvas is gone."));
      imagesRendered += 1;
      if (imagesRendered === options.abortAfterImages) abort.abort();
      return Promise.resolve(new TextEncoder().encode(`image of ${code}`));
    },
    onProgress: (step) => progress.push(step),
    signal: abort.signal,
    sleep(milliseconds) {
      sleeps.push(milliseconds);
      return Promise.resolve();
    },
    now: () => RUN_STARTED,
    randomIndex: countingIndex(),
  };
  const readText = (path: string) => new TextDecoder().decode(files.get(path));
  return { deps, events, files, createInputs, batches, sleeps, progress, readText };
}

/**
 * Makes the codes known: code number n is n written in four digits of the pool, so with four
 * random characters the first three are AAAA, AAAB, AAAC and thousands of codes still differ.
 */
function countingIndex(): RandomIndex {
  let draws = 0;
  return (poolSize) => {
    const position = draws % 4;
    const codeNumber = Math.floor(draws / 4);
    draws += 1;
    return Math.floor(codeNumber / poolSize ** (3 - position)) % poolSize;
  };
}

function settingsFor(patch: Partial<VoucherSettings>): VoucherSettings {
  return {
    ...defaultVoucherSettings(new Date(2026, 10, 19)),
    prefix: "T-",
    randomLength: 4,
    voucherCount: 3,
    savePath: SAVE_FOLDER,
    ...patch,
  };
}

function request(patch: Partial<VoucherSettings> = {}) {
  return { settings: settingsFor(patch), output: getOutputFile("template.jpg") };
}

async function failureOf(run: Promise<unknown>): Promise<GenerateRunError> {
  const failure: unknown = await run.then(
    () => null,
    (error: unknown) => error,
  );
  if (!(failure instanceof GenerateRunError)) throw new Error("The run did not fail as expected.");
  return failure;
}

describe("runGenerate: the order of a good run", () => {
  it("writes the codes file, creates the discount, adds the rest, then writes each image", async () => {
    const fakes = makeFakes();

    const outcome = await runGenerate(request(), fakes.deps);

    expect(fakes.events).toEqual([
      "write:D:\\vouchers\\codes-T-20261119-143005.csv",
      "create",
      "add:2",
      "poll:bulk-1",
      "render:T-AAAA",
      "write:D:\\vouchers\\T-AAAA.jpg",
      "render:T-AAAB",
      "write:D:\\vouchers\\T-AAAB.jpg",
      "render:T-AAAC",
      "write:D:\\vouchers\\T-AAAC.jpg",
    ]);
    expect(fakes.readText(CODES_PATH)).toBe("code\nT-AAAA\nT-AAAB\nT-AAAC\n");
    expect(fakes.batches).toEqual([["T-AAAB", "T-AAAC"]]);
    expect(fakes.readText("D:\\vouchers\\T-AAAB.jpg")).toBe("image of T-AAAB");
    expect(outcome).toEqual({
      aborted: false,
      codesPath: CODES_PATH,
      discountTitle: "Workbench — T-",
      codeCount: 3,
      imagesWritten: 3,
    });
  });

  it("sends the first code, the title and the dates as whole UTC days", async () => {
    const fakes = makeFakes();

    await runGenerate(
      request({ startDate: "2026-11-19", endDate: "2026-12-24", percentage: 15 }),
      fakes.deps,
    );

    expect(fakes.createInputs).toHaveLength(1);
    expect(fakes.createInputs[0]).toMatchObject({
      title: "Workbench — T-",
      code: "T-AAAA",
      startsAt: "2026-11-19T00:00:00Z",
      endsAt: "2026-12-24T23:59:59Z",
      customerGets: { value: { percentage: 0.15 }, items: { all: true } },
    });
  });

  it("keeps a folder's own separator and a trailing one", async () => {
    const fakes = makeFakes();

    await runGenerate(request({ savePath: "/home/vouchers/", voucherCount: 1 }), fakes.deps);

    expect(fakes.events).toEqual([
      "write:/home/vouchers/codes-T-20261119-143005.csv",
      "create",
      "render:T-AAAA",
      "write:/home/vouchers/T-AAAA.jpg",
    ]);
  });

  it("writes PNG files for a PNG template", async () => {
    const fakes = makeFakes();

    await runGenerate(
      { settings: settingsFor({ voucherCount: 1 }), output: getOutputFile("template.png") },
      fakes.deps,
    );

    expect(fakes.events.at(-1)).toBe("write:D:\\vouchers\\T-AAAA.png");
  });

  it("never lets a code's characters leave the save folder", async () => {
    const fakes = makeFakes();

    await runGenerate(request({ prefix: "..\\A/B:", voucherCount: 1 }), fakes.deps);

    expect(fakes.readText("D:\\vouchers\\codes-..-A-B--20261119-143005.csv")).toBe(
      "code\n..\\A/B:AAAA\n",
    );
    expect(fakes.events.at(-1)).toBe("write:D:\\vouchers\\-A-B-AAAA.jpg");
  });

  it("quotes a code that would break the CSV", async () => {
    const fakes = makeFakes();

    await runGenerate(request({ prefix: 'A,"B"', voucherCount: 1 }), fakes.deps);

    expect(fakes.readText("D:\\vouchers\\codes-A,-B--20261119-143005.csv")).toBe(
      'code\n"A,""B""AAAA"\n',
    );
  });
});

describe("runGenerate: batches", () => {
  it.each([
    { count: 1, expected: [] },
    { count: 250, expected: [249] },
    { count: 251, expected: [250] },
    { count: 252, expected: [250, 1] },
    { count: 600, expected: [250, 250, 99] },
  ])("$count codes go as one create call and batches of $expected", async ({ count, expected }) => {
    const fakes = makeFakes();

    await runGenerate(request({ voucherCount: count }), fakes.deps);

    expect(fakes.batches.map((batch) => batch.length)).toEqual(expected);
    expect(fakes.events.filter((event) => event === "create")).toHaveLength(1);
    const sent = [String(fakes.createInputs[0]?.code), ...fakes.batches.flat()];
    expect(new Set(sent).size).toBe(count);
    expect(fakes.readText(CODES_PATH)).toBe(`code\n${sent.join("\n")}\n`);
  });

  it("waits for one batch to finish before it sends the next", async () => {
    const fakes = makeFakes({
      bulkAnswers: [
        {
          polls: [
            { done: false, importedCount: 0, failedCount: 0 },
            { done: false, importedCount: 120, failedCount: 0 },
            { done: true, importedCount: 250, failedCount: 0 },
          ],
        },
      ],
    });

    await runGenerate(request({ voucherCount: 252 }), fakes.deps);

    expect(fakes.events.slice(1, 8)).toEqual([
      "create",
      "add:250",
      "poll:bulk-1",
      "poll:bulk-1",
      "poll:bulk-1",
      "add:1",
      "poll:bulk-2",
    ]);
    expect(fakes.sleeps).toEqual([1000, 1000, 1000, 1000]);
  });
});

describe("runGenerate: progress", () => {
  it("reports each stage, and the images every tenth one and at the end", async () => {
    const fakes = makeFakes();

    await runGenerate(request({ voucherCount: 12 }), fakes.deps);

    expect(fakes.progress).toEqual([
      { stage: "codes" },
      { stage: "discount" },
      { stage: "addingCodes", added: 1, total: 12 },
      { stage: "addingCodes", added: 12, total: 12 },
      { stage: "images", written: 0, total: 12 },
      { stage: "images", written: 10, total: 12 },
      { stage: "images", written: 12, total: 12 },
    ]);
  });
});

describe("formatGenerateProgress", () => {
  it("names the step and how far it is", () => {
    expect(formatGenerateProgress({ stage: "codes" })).toBe("Generating unique codes…");
    expect(formatGenerateProgress({ stage: "discount" })).toBe("Creating Shopify discount…");
    expect(formatGenerateProgress({ stage: "addingCodes", added: 251, total: 600 })).toBe(
      "Adding codes to Shopify: 251 of 600",
    );
    expect(formatGenerateProgress({ stage: "images", written: 40, total: 600 })).toBe(
      "Rendering voucher images: 40 of 600",
    );
  });
});

describe("runGenerate: failures before the discount exists", () => {
  it("says nothing was created when the codes cannot be generated", async () => {
    const fakes = makeFakes();

    const failure = await failureOf(
      runGenerate(request({ randomLength: 1, voucherCount: 50 }), fakes.deps),
    );

    expect(failure.message).toBe(
      "Pool too small: 32^1 = 32 possible values for 50 codes. Increase random character count. " +
        "Nothing was created in Shopify.",
    );
    expect(failure.discountCreated).toBe(false);
    expect(failure.codesPath).toBeNull();
    expect(fakes.events).toEqual([]);
  });

  it("calls Shopify for nothing when the codes file cannot be written", async () => {
    const fakes = makeFakes({ failWriteOf: CODES_PATH });

    const failure = await failureOf(runGenerate(request(), fakes.deps));

    expect(failure.message).toBe("The disk is full. Nothing was created in Shopify.");
    expect(failure.codesPath).toBeNull();
    expect(fakes.events).toEqual(["write:D:\\vouchers\\codes-T-20261119-143005.csv"]);
  });

  it("says the codes file is of no use when Shopify refuses the discount", async () => {
    const fakes = makeFakes({
      createUserErrors: [{ field: ["basicCodeDiscount", "code"], message: "Code must be unique" }],
    });

    const failure = await failureOf(runGenerate(request(), fakes.deps));

    expect(failure.message).toBe(
      "Discount creation failed: basicCodeDiscount.code: Code must be unique. " +
        "Nothing was created in Shopify. " +
        "The codes in D:\\vouchers\\codes-T-20261119-143005.csv do not exist there: delete that file.",
    );
    expect(failure.discountCreated).toBe(false);
    expect(failure.codesPath).toBe(CODES_PATH);
    expect(fakes.events).toEqual(["write:D:\\vouchers\\codes-T-20261119-143005.csv", "create"]);
  });
});

describe("runGenerate: the create call fails without Shopify refusing it", () => {
  const MAY_EXIST =
    'The discount "Workbench — T-" may exist in Shopify all the same: ' +
    "check Discounts in the Shopify admin before you delete " +
    "D:\\vouchers\\codes-T-20261119-143005.csv.";

  it("says the discount may exist when the connection drops during the create call", async () => {
    const fakes = makeFakes({ createFailure: new Error("The request to Shopify timed out.") });

    const failure = await failureOf(runGenerate(request(), fakes.deps));

    expect(failure.message).toBe(`The request to Shopify timed out. ${MAY_EXIST}`);
    expect(failure.message).not.toContain("Nothing was created");
    expect(failure.discountCreated).toBe(false);
    expect(failure.codesPath).toBe(CODES_PATH);
    expect(fakes.events).toEqual([`write:${CODES_PATH}`, "create"]);
  });

  it("says the same for a server error", async () => {
    const fakes = makeFakes({ createFailure: new Error("Shopify answered HTTP 502") });

    const failure = await failureOf(runGenerate(request(), fakes.deps));

    expect(failure.message).toBe(`Shopify answered HTTP 502. ${MAY_EXIST}`);
  });

  it("says the same when Shopify answers with no discount and no user error", async () => {
    const fakes = makeFakes({ createGivesNoDiscount: true });

    const failure = await failureOf(runGenerate(request(), fakes.deps));

    expect(failure.message).toBe(
      `Discount creation failed: Shopify returned no discount. ${MAY_EXIST}`,
    );
  });

  it("still says nothing was created for a GraphQL error", async () => {
    const fakes = makeFakes({
      createFailure: new Error("Shopify GraphQL error: Access denied for discountCodeBasicCreate"),
    });

    const failure = await failureOf(runGenerate(request(), fakes.deps));

    expect(failure.message).toBe(
      "Shopify GraphQL error: Access denied for discountCodeBasicCreate. " +
        "Nothing was created in Shopify. " +
        "The codes in D:\\vouchers\\codes-T-20261119-143005.csv do not exist there: delete that file.",
    );
  });
});

describe("runGenerate: a collection discount with no collection", () => {
  // WARNING: this is money. Such a discount would be built as a discount on every product.
  it("stops before the codes file and before any Shopify call", async () => {
    const fakes = makeFakes();

    const failure = await failureOf(
      runGenerate(request({ appliesTo: "collection", collectionIds: [] }), fakes.deps),
    );

    expect(failure.message).toBe(
      "A discount for specific collections needs at least one collection. " +
        "Nothing was created in Shopify.",
    );
    expect(fakes.events).toEqual([]);
  });
});

describe("runGenerate: failures after the discount exists", () => {
  const AFTER_THE_COUNT =
    "Every code is listed in D:\\vouchers\\codes-T-20261119-143005.csv. " +
    "Delete the discount in Shopify admin before you generate again.";

  it("names the codes that made it when Shopify refuses part of a batch", async () => {
    const fakes = makeFakes({
      bulkAnswers: [{}, { polls: [{ done: true, importedCount: 240, failedCount: 10 }] }],
    });

    const failure = await failureOf(runGenerate(request({ voucherCount: 600 }), fakes.deps));

    expect(failure.message).toBe(
      "Shopify refused 10 of the 250 codes in batch 2 of 3. " +
        'The discount "Workbench — T-" exists in Shopify with 491 of 600 codes. ' +
        AFTER_THE_COUNT,
    );
    expect(failure.discountCreated).toBe(true);
    expect(failure.codesPath).toBe(CODES_PATH);
    expect(fakes.batches).toHaveLength(2);
    expect(fakes.events.some((event) => event.startsWith("render:"))).toBe(false);
  });

  it("stops on a bulk-add user error and counts only the batches before it", async () => {
    const fakes = makeFakes({
      bulkAnswers: [{}, { userErrors: [{ field: ["codes"], message: "Too many codes" }] }],
    });

    const failure = await failureOf(runGenerate(request({ voucherCount: 600 }), fakes.deps));

    expect(failure.message).toBe(
      "Code creation failed: codes: Too many codes. " +
        'The discount "Workbench — T-" exists in Shopify with 251 of 600 codes. ' +
        AFTER_THE_COUNT,
    );
    expect(fakes.events.filter((event) => event.startsWith("poll:"))).toEqual(["poll:bulk-1"]);
  });

  it("gives up on a batch Shopify never finishes, after a bounded wait", async () => {
    const fakes = makeFakes({
      bulkAnswers: [{ polls: [{ done: false, importedCount: 1, failedCount: 0 }] }],
    });

    const failure = await failureOf(runGenerate(request(), fakes.deps));

    expect(failure.message).toBe(
      "Shopify did not finish adding batch 1 of 1 within 120 seconds. " +
        'The discount "Workbench — T-" exists in Shopify with at least 2 of 3 codes. ' +
        AFTER_THE_COUNT,
    );
    expect(fakes.sleeps).toHaveLength(120);
  });

  it("says 'at least' when the connection drops while a batch is being sent", async () => {
    const fakes = makeFakes({
      addFailure: { batchIndex: 1, error: new Error("The request to Shopify timed out.") },
    });

    const failure = await failureOf(runGenerate(request({ voucherCount: 600 }), fakes.deps));

    expect(failure.message).toBe(
      "The request to Shopify timed out. " +
        'The discount "Workbench — T-" exists in Shopify with at least 251 of 600 codes. ' +
        AFTER_THE_COUNT,
    );
  });

  it("says 'at least' when a poll fails while Shopify is still adding the batch", async () => {
    const fakes = makeFakes({
      pollFailure: { id: "bulk-2", error: new Error("Shopify GraphQL error: Throttled") },
    });

    const failure = await failureOf(runGenerate(request({ voucherCount: 600 }), fakes.deps));

    expect(failure.message).toBe(
      "Shopify GraphQL error: Throttled. " +
        'The discount "Workbench — T-" exists in Shopify with at least 251 of 600 codes. ' +
        AFTER_THE_COUNT,
    );
  });

  it("names the images written when one cannot be saved", async () => {
    const fakes = makeFakes({ failWriteOf: "D:\\vouchers\\T-AAAC.jpg" });

    const failure = await failureOf(runGenerate(request(), fakes.deps));

    expect(failure.message).toBe(
      "The disk is full. " +
        'The discount "Workbench — T-" exists in Shopify with all 3 codes, ' +
        "but only 2 of 3 images were written. " +
        AFTER_THE_COUNT,
    );
    expect(failure.discountCreated).toBe(true);
  });

  it("reports a failed render the same way", async () => {
    const fakes = makeFakes({ failImageOf: "T-AAAA" });

    const failure = await failureOf(runGenerate(request(), fakes.deps));

    expect(failure.message).toBe(
      "The canvas is gone. " +
        'The discount "Workbench — T-" exists in Shopify with all 3 codes, ' +
        "but only 0 of 3 images were written. " +
        AFTER_THE_COUNT,
    );
  });
});

describe("runGenerate: abort", () => {
  it("stops between two images and says how far it got", async () => {
    const fakes = makeFakes({ abortAfterImages: 2 });

    const outcome = await runGenerate(request({ voucherCount: 5 }), fakes.deps);

    expect(outcome).toEqual({
      aborted: true,
      codesPath: CODES_PATH,
      discountTitle: "Workbench — T-",
      codeCount: 5,
      imagesWritten: 2,
    });
    expect(fakes.events.filter((event) => event.startsWith("render:"))).toEqual([
      "render:T-AAAA",
      "render:T-AAAB",
    ]);
    // The image being rendered when the abort came is still written: a file is never half done.
    expect(fakes.events.at(-1)).toBe("write:D:\\vouchers\\T-AAAB.jpg");
  });
});
