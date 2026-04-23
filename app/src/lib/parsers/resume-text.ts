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
    const base64Data = buffer.toString("base64");
    console.log(`[resume-text] PDF size: ${buffer.length} bytes`);
    const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);

    // Primary: Anthropic PDF understanding
    if (hasAnthropicKey) {
      try {
        const client = getAnthropic();
        const response = await client.messages.create({
          model: DEFAULT_MODEL,
          max_tokens: 4096,
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
                  text:
                    "Extract the full plain text of this document, preserving section order and line breaks. Output only the text, no commentary.",
                },
              ],
            },
          ],
        });
        const text = response.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join("\n")
          .trim();
        if (text.length > 50) {
          return { rawText: text, sourceType: "pdf" };
        }
        console.warn("[resume-text] Anthropic returned short text, falling back to unpdf");
      } catch (err) {
        console.error(
          "[resume-text] Anthropic PDF extraction failed, falling back to unpdf:",
          err,
        );
      }
    } else {
      console.warn("[resume-text] ANTHROPIC_API_KEY not set; using unpdf fallback only.");
    }

    // Fallback: unpdf — serverless-friendly PDF text extraction (no native deps).
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const uint8 = new Uint8Array(
        buffer.buffer,
        buffer.byteOffset,
        buffer.byteLength,
      );
      const pdf = await getDocumentProxy(uint8);
      const { text } = await extractText(pdf, { mergePages: true });
      const rawText = (Array.isArray(text) ? text.join("\n") : text)?.trim() ?? "";
      const normalized = rawText
        .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
        .trim();
      if (!normalized) {
        throw new Error(
          "Could not extract selectable text from this PDF. It may be a scanned/image PDF. Please upload DOCX or a text-based PDF.",
        );
      }
      console.log(`[resume-text] unpdf extracted ${rawText.length} chars`);
      return { rawText, sourceType: "pdf" };
    } catch (err) {
      console.error("[resume-text] unpdf fallback failed:", err);
      throw new Error(
        "Could not extract text from this PDF. Try saving it as a DOCX or plain text file.",
      );
    }
  }

  throw new Error(
    "Unsupported file type. Upload a PDF, DOCX, or plain text resume.",
  );
}
