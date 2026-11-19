// Saves a statement as a PDF or a CSV where the user picks (the save dialog asks before it
// replaces a file). The PDF library is loaded only now, on the first export, so it is not part of
// the start of the app. Both writes go through the app's own file command.
import { pickSaveFile, safeFileName, writeFileBytes, fileNameOf } from "../../lib/files";
import type { Statement } from "./core/statement";
import { statementCsv } from "./core/statementCsv";
import { buildStatementDocument } from "./core/statementDocument";

export type StatementFormat = "pdf" | "csv";

const FORMATS: Record<StatementFormat, { title: string; filterName: string }> = {
  pdf: { title: "Save the statement as PDF", filterName: "PDF" },
  csv: { title: "Save the statement as CSV", filterName: "CSV" },
};

/** The PDF of a statement as bytes. pdfmake and its bundled Roboto font are loaded on first use. */
export async function makeStatementPdf(statement: Statement): Promise<Uint8Array> {
  const [{ default: pdfMake }, { default: fonts }] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  pdfMake.addVirtualFileSystem(fonts);
  const blob = await pdfMake.createPdf(buildStatementDocument(statement)).getBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

function makeStatementCsv(statement: Statement): Uint8Array {
  return new TextEncoder().encode(statementCsv(statement));
}

/** "Payout 2031-01 - Printer A", before the extension. */
function defaultNameOf(statement: Statement): string {
  return safeFileName(`Payout ${statement.month} - ${statement.personName}`);
}

/**
 * Asks where to save, then writes the file. Returns the saved file's name, or null when the user
 * cancelled the dialog. The dialog comes first, so a cancel never builds the PDF.
 */
export async function exportStatement(
  statement: Statement,
  format: StatementFormat,
): Promise<string | null> {
  const { title, filterName } = FORMATS[format];
  const path = await pickSaveFile({
    title,
    defaultName: `${defaultNameOf(statement)}.${format}`,
    filters: [{ name: filterName, extensions: [format] }],
  });
  if (path === null) return null;
  const bytes = format === "pdf" ? await makeStatementPdf(statement) : makeStatementCsv(statement);
  await writeFileBytes(path, bytes);
  return fileNameOf(path);
}
