import mammoth from "mammoth";

export type ExtractedResume = {
  rawText: string;
  sourceType: "pdf" | "docx" | "txt";
};

export async function extractTextFromUpload(
  buffer: Buffer,
  mimeType: string,
  filename: string,
): Promise<ExtractedResume> {
  const lowerName = filename.toLowerCase();
  const isPdf = mimeType === "application/pdf" || lowerName.endsWith(".pdf");
  const isDocx =
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx");
  const isText = mimeType.startsWith("text/") || lowerName.endsWith(".txt");

  if (isDocx) {
    const { value } = await mammoth.extractRawText({ buffer });
    return { rawText: value, sourceType: "docx" };
  }

  if (isText) {
    return { rawText: buffer.toString("utf8"), sourceType: "txt" };
  }

  if (isPdf) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
    const result = await pdfParse(buffer);
    const rawText = result.text?.trim() ?? "";
    if (!rawText) {
      throw new Error(
        "Could not extract text from this PDF. Try saving it as a DOCX or plain text file.",
      );
    }
    return { rawText, sourceType: "pdf" };
  }

  throw new Error(
    "Unsupported file type. Upload a PDF, DOCX, or plain text resume.",
  );
}
