export type GenerationStage =
  | "preparing"
  | "generating"
  | "validating"
  | "finalizing";

export type GenerationStreamEvent =
  | {
      type: "progress";
      stage: GenerationStage;
      percent: number;
      elapsedMs: number;
    }
  | { type: "content"; content: string }
  | { type: "error"; message: string };

export function encodeGenerationStreamEvent(event: GenerationStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}
