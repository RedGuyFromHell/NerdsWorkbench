// Which files the voucher template picker takes: the three types the old app listed.

/** Without the dot, as a dialog filter wants them. */
export const TEMPLATE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

export function isTemplateFileName(name: string): boolean {
  const dot = name.lastIndexOf(".");
  return dot > 0 && TEMPLATE_EXTENSIONS.includes(name.slice(dot + 1).toLowerCase());
}
