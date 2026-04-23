import mammoth from "mammoth";
import { getGemini, DEFAULT_MODEL } from "@/lib/ai/anthropic";

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
    const base64Data = buffer.toString("base64");
    console.log(`[resume-text] PDF size: ${buffer.length} bytes`);

    // Primary: Gemini inlineData PDF understanding
    try {
      const client = getGemini();
      const model = client.getGenerativeModel({ model: DEFAULT_MODEL });
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: "application/pdf",
            data: base64Data,
          },
        },
        "Extract the full plain text of this document, preserving section order and line breaks. Output only the text, no commentary.",
      ]);
      const text = result.response.text().trim();
      if (text.length > 50) {
        return { rawText: text, sourceType: "pdf" };
      }
      console.warn("[resume-text] Gemini returned short text, falling back to pdf-parse");
    } catch (err) {
      console.error("[resume-text] Gemini PDF extraction failed, falling back to pdf-parse:", err);
    }

    // Fallback: pdf-parse for direct text extraction
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
      const result = await pdfParse(buffer);
      const rawText = result.text?.trim() ?? "";
      if (!rawText) throw new Error("pdf-parse returned empty text");
      console.log(`[resume-text] pdf-parse extracted ${rawText.length} chars`);
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
