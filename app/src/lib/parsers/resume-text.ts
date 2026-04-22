import mammoth from "mammoth";
import { getAnthropic, DEFAULT_MODEL } from "@/lib/ai/anthropic";

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
    // Primary: use Claude's native PDF document understanding
    try {
      const client = getAnthropic();
      const base64Data = buffer.toString("base64");
      console.log(`[resume-text] PDF size: ${buffer.length} bytes, base64 length: ${base64Data.length}`);
      const resp = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 6000,
        system:
          "You are a document text extractor. Return the full plain text of the PDF, preserving section order and line breaks. No commentary.",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: "Extract the full plain text.",
              },
            ],
          },
        ],
      });
      const text = resp.content
        .filter((b) => b.type === "text")
        .map((b) => (b as { type: "text"; text: string }).text)
        .join("\n")
        .trim();
      if (text.length > 50) {
        return { rawText: text, sourceType: "pdf" };
      }
      console.warn("[resume-text] Claude PDF extraction returned short text, falling back to pdf-parse");
    } catch (err) {
      console.error("[resume-text] Claude PDF extraction failed, falling back to pdf-parse:", err);
    }

    // Fallback: use pdf-parse to extract raw text
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      const rawText = result.text?.trim() ?? "";
      if (!rawText) throw new Error("pdf-parse returned empty text");
      return { rawText, sourceType: "pdf" };
    } catch (err) {
      console.error("[resume-text] pdf-parse fallback failed:", err);
      throw new Error(
        "Could not extract text from this PDF. Try saving it as a DOCX or plain text file.",
      );
    }
  }

  throw new Error(
    "Unsupported file type. Upload a PDF, DOCX, or plain text resume.",
  );
}
