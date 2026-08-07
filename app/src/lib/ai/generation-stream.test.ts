import { describe, expect, it } from "vitest";
import { encodeGenerationStreamEvent } from "./generation-stream";

describe("generation stream protocol", () => {
  it("encodes one JSON event per line without changing generated content", () => {
    const content = "Line one\nLine two";
    const encoded = encodeGenerationStreamEvent({ type: "content", content });

    expect(encoded.endsWith("\n")).toBe(true);
    expect(JSON.parse(encoded.trim())).toEqual({ type: "content", content });
  });
});
