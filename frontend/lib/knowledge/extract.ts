/**
 * Text extraction for uploaded knowledge files.
 * PDF via unpdf (serverless-friendly pdfjs), DOCX via mammoth,
 * plain/markdown/CSV/JSON/HTML natively.
 */

export class ExtractError extends Error {}

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown", "csv", "json", "log", "yaml", "yml"]);

function extOf(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

export function extractableType(filename: string, mime?: string | null): boolean {
  const ext = extOf(filename);
  if (TEXT_EXTENSIONS.has(ext) || ["pdf", "docx", "html", "htm"].includes(ext)) return true;
  if (!mime) return false;
  return mime === "application/pdf"
    || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    || mime.startsWith("text/");
}

export async function extractText(buffer: ArrayBuffer, filename: string, mime?: string | null): Promise<string> {
  const ext = extOf(filename);

  if (ext === "pdf" || mime === "application/pdf") {
    const { extractText: extractPdf } = await import("unpdf");
    const { text } = await extractPdf(new Uint8Array(buffer), { mergePages: true });
    return text;
  }

  if (ext === "docx" || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return value;
  }

  if (ext === "html" || ext === "htm" || mime === "text/html") {
    return stripHtml(new TextDecoder().decode(buffer));
  }

  if (TEXT_EXTENSIONS.has(ext) || mime?.startsWith("text/")) {
    return new TextDecoder().decode(buffer);
  }

  throw new ExtractError(`Unsupported file type: ${filename}${mime ? ` (${mime})` : ""}`);
}
