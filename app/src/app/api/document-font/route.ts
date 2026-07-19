import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
// Must stay dynamic: with `force-static` this route is prerendered at build
// time without query params, so every request served the baked-in 400.
export const dynamic = "force-dynamic";

const FONT_FILES = {
  regular: ["400Regular", "Caladea_400Regular.ttf"],
  italic: ["400Regular_Italic", "Caladea_400Regular_Italic.ttf"],
  bold: ["700Bold", "Caladea_700Bold.ttf"],
  boldItalic: ["700Bold_Italic", "Caladea_700Bold_Italic.ttf"],
} as const;

type FontVariant = keyof typeof FONT_FILES;

function isFontVariant(value: string | null): value is FontVariant {
  return value !== null && Object.hasOwn(FONT_FILES, value);
}

export async function GET(request: Request) {
  const variant = new URL(request.url).searchParams.get("variant");
  if (!isFontVariant(variant)) {
    return Response.json({ error: "Unknown font variant." }, { status: 400 });
  }

  const [folder, filename] = FONT_FILES[variant];
  const fontPath = path.join(
    process.cwd(),
    "node_modules",
    "@expo-google-fonts",
    "caladea",
    folder,
    filename,
  );

  const bytes = await readFile(fontPath);
  return new Response(bytes, {
    headers: {
      "Content-Type": "font/ttf",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
