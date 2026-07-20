import mammoth from "mammoth";

export type ExtractedResume = {
  rawText: string;
  sourceType: "pdf" | "docx" | "txt";
};

type PdfTextItemLike = {
  str: string;
  transform?: number[];
  width?: number;
  height?: number;
  hasEOL?: boolean;
};

export function joinPdfTextItems(items: PdfTextItemLike[]): string {
  let text = "";
  let previous: PdfTextItemLike | null = null;

  for (const item of items) {
    const value = item.str ?? "";
    if (previous) {
      const previousX = previous.transform?.[4] ?? 0;
      const previousY = previous.transform?.[5] ?? 0;
      const currentX = item.transform?.[4] ?? previousX;
      const currentY = item.transform?.[5] ?? previousY;
      const previousHeight = Math.max(
        1,
        previous.height ?? Math.abs(previous.transform?.[3] ?? 0),
      );
      const currentHeight = Math.max(1, item.height ?? Math.abs(item.transform?.[3] ?? 0));
      const lineChanged = Boolean(previous.hasEOL)
        || Math.abs(currentY - previousY) > Math.max(
          1.5,
          Math.min(previousHeight, currentHeight) * 0.35,
        )
        || currentX < previousX - 2;

      if (lineChanged) {
        text = `${text.trimEnd()}\n`;
      } else if (value && !/\s$/.test(text) && !/^\s/.test(value)) {
        const previousRight = previousX + Math.max(0, previous.width ?? 0);
        const gap = currentX - previousRight;
        if (gap > Math.max(0.5, Math.min(previousHeight, currentHeight) * 0.06)) {
          text += " ";
        }
      }
    }

    text += value;
    previous = item;
  }

  return text.trim();
}

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
      // Preserve both PDF line geometry and horizontal gaps. pdf.js frequently
      // emits adjacent words as separate items without an embedded space.
      const pageTexts: string[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const { items } = await page.getTextContent();
        const textItems = items.flatMap((item): PdfTextItemLike[] => (
          "str" in item
            ? [{
                str: item.str,
                transform: item.transform,
                width: item.width,
                height: item.height,
                hasEOL: item.hasEOL,
              }]
            : []
        ));
        pageTexts.push(joinPdfTextItems(textItems));
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
