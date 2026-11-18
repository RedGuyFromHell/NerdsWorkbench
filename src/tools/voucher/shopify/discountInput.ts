// The `DiscountCodeBasicInput` for `discountCodeBasicCreate`, built from the screen's settings.
// Only the first code goes in here (the input has one `code`); the rest are added in batches.
import { roundHalfToEven } from "../core/roundHalfToEven";

export interface DiscountSettings {
  title: string;
  firstCode: string;
  /** 0 to 100, as the user types it. */
  percentage: number;
  appliesTo: "all" | "collection";
  /** Collection GIDs, or the numeric part of one as a number or a string. */
  collectionIds: readonly (string | number)[];
  /** 0 means no minimum. */
  minimumSubtotal: number;
  /** 0 means unlimited. */
  usageLimit: number;
  oncePerCustomer: boolean;
  startsAt: string;
  endsAt: string | null;
}

export interface DiscountCodeBasicInput {
  title: string;
  code: string;
  startsAt: string;
  endsAt?: string;
  customerGets: {
    value: { percentage: number };
    items: { all: true } | { collections: { add: string[] } };
  };
  customerSelection: { all: true };
  appliesOncePerCustomer: boolean;
  combinesWith: {
    orderDiscounts: boolean;
    productDiscounts: boolean;
    shippingDiscounts: boolean;
  };
  usageLimit?: number;
  minimumRequirement?: { subtotal: { greaterThanOrEqualToSubtotal: string } };
}

const COLLECTION_GID_PREFIX = "gid://shopify/Collection/";
const GID_SCHEME = "gid://";
const TITLE_PREFIX = "Workbench";
const TITLE_SEPARATOR = " — ";
// Everything but these is dropped from the prefix before it goes in a discount title.
const TITLE_UNSAFE_CHARACTERS = /[^A-Za-z0-9 _-]/g;

export function buildDiscountInput(settings: DiscountSettings): DiscountCodeBasicInput {
  const input: DiscountCodeBasicInput = {
    title: settings.title,
    code: settings.firstCode,
    startsAt: settings.startsAt,
    customerGets: {
      value: { percentage: settings.percentage / 100 },
      items: getDiscountedItems(settings),
    },
    customerSelection: { all: true },
    appliesOncePerCustomer: settings.oncePerCustomer,
    // WHY: stacks with product and shipping discounts, never with another order discount.
    // Shopify defaults every combinesWith field to false, which would stop the voucher
    // combining with anything, free shipping included.
    combinesWith: {
      orderDiscounts: false,
      productDiscounts: true,
      shippingDiscounts: true,
    },
  };
  if (settings.endsAt) input.endsAt = settings.endsAt;
  if (settings.usageLimit > 0) input.usageLimit = settings.usageLimit;
  if (settings.minimumSubtotal > 0) {
    input.minimumRequirement = {
      subtotal: { greaterThanOrEqualToSubtotal: formatMinimumSubtotal(settings.minimumSubtotal) },
    };
  }
  return input;
}

// WARNING: "specific collections" with none picked falls through to all products, as the old
// app did. The screen has to stop that before a discount is created.
function getDiscountedItems(
  settings: DiscountSettings,
): DiscountCodeBasicInput["customerGets"]["items"] {
  const collectionGids = settings.collectionIds.map(toCollectionGid);
  if (settings.appliesTo === "collection" && collectionGids.length > 0) {
    return { collections: { add: collectionGids } };
  }
  return { all: true };
}

function toCollectionGid(collectionId: string | number): string {
  const text = String(collectionId);
  return text.startsWith(GID_SCHEME) ? text : `${COLLECTION_GID_PREFIX}${text}`;
}

/** The amount as Shopify wants it: two decimals, an exact half cent going to the even cent. */
export function formatMinimumSubtotal(amount: number): string {
  // WHY: Python's format rounds an exact tie to even (0.125 gives 0.12) and toFixed rounds it
  // up (0.13). Only a multiple of an eighth can tie exactly, so only those are rounded by hand.
  const eighths = amount * 8;
  if (Number.isInteger(eighths) && eighths % 2 !== 0) {
    return (roundHalfToEven(amount * 100) / 100).toFixed(2);
  }
  return amount.toFixed(2);
}

export function buildDiscountTitle(prefix: string): string {
  const safePrefix = prefix.replace(TITLE_UNSAFE_CHARACTERS, "").trim();
  return `${TITLE_PREFIX}${TITLE_SEPARATOR}${safePrefix || TITLE_PREFIX}`;
}
