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
    console.log(`[resume-text] PDF size: ${buffer.length} bytes`);
    // Serverless-friendly PDF text extraction (no native deps). AI parsing happens after this step through DeepSeek.
    try {
      const { getDocumentProxy } = await import("unpdf");
      // PDF.js transfers (detaches) the buffer it receives, so hand it a copy —
      // otherwise the caller's bytes are zeroed and later uploads store empty files.
      const uint8 = new Uint8Array(buffer);
      const pdf = await getDocumentProxy(uint8);
      // unpdf's extractText joins items with spaces and loses line breaks, which
      // collapses the resume into one line and breaks every line-based consumer
      // (header extraction, format-lock candidates). Walk the text items and
      // honor pdf.js line-break markers instead.
      const pageTexts: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const { items } = await page.getTextContent();
        let pageText = "";
        for (const item of items) {
          if (!("str" in item)) continue;
          pageText += item.str;
          if (item.hasEOL) pageText += "\n";
        }
        pageTexts.push(pageText);
      }
      const rawText = pageTexts.join("\n").trim();
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
