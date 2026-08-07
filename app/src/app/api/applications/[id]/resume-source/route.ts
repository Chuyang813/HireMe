import { getOptionalUser } from "@/lib/auth/current-user";
import { uuidSchema } from "@/lib/security/limits";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase, user } = await getOptionalUser();
  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) {
    return Response.json({ error: "Application not found." }, { status: 404 });
  }

  const { data: application } = await supabase
    .from("job_applications")
    .select("base_resume_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!application) {
    return Response.json({ error: "Application not found." }, { status: 404 });
  }

  const resumeQuery = supabase
    .from("base_resumes")
    .select("source_file_path, source_file_type")
    .eq("user_id", user.id);
  const { data: resume } = application.base_resume_id
    ? await resumeQuery.eq("id", application.base_resume_id).single()
    : await resumeQuery.eq("is_default", true).single();

  const sourceType = resume?.source_file_type;
  if (
    !resume?.source_file_path
    || (sourceType !== "pdf" && sourceType !== "docx")
  ) {
    return Response.json(
      { error: "The uploaded document/PDF could not be found." },
      { status: 404 },
    );
  }

  const requestScopedFile = await supabase.storage
    .from("resumes")
    .download(resume.source_file_path);
  let sourceBytes = await readNonEmptySourceBytes(requestScopedFile.data);
  let receivedEmptyFile = Boolean(requestScopedFile.data) && !sourceBytes;

  // Ownership was verified above. If the request-scoped storage token cannot
  // read a complete older object, retry server-side without exposing its path.
  if (requestScopedFile.error || !sourceBytes) {
    try {
      const adminFile = await getSupabaseAdmin().storage
        .from("resumes")
        .download(resume.source_file_path);
      const adminBytes = await readNonEmptySourceBytes(adminFile.data);
      receivedEmptyFile = receivedEmptyFile || (Boolean(adminFile.data) && !adminBytes);
      if (adminBytes) sourceBytes = adminBytes;
    } catch {
      // Return the same safe, user-facing error below.
    }
  }

  if (!sourceBytes && !receivedEmptyFile) {
    return Response.json(
      { error: "Could not load the uploaded document/PDF." },
      { status: 404 },
    );
  }

  if (!sourceBytes) {
    return Response.json(
      { error: "The uploaded document/PDF is empty." },
      { status: 422 },
    );
  }

  return new Response(sourceBytes, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Length": String(sourceBytes.byteLength),
      "Content-Type": sourceType === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function readNonEmptySourceBytes(file: Blob | null): Promise<ArrayBuffer | null> {
  if (!file) return null;
  try {
    const bytes = await file.arrayBuffer();
    return bytes.byteLength > 0 ? bytes : null;
  } catch {
    return null;
  }
}
