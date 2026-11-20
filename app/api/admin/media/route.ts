import { NextResponse } from "next/server";
import { getAdminApi } from "@/lib/auth";
import { storeUploadedFile } from "@/lib/storage";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await getAdminApi("ads.manage");
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error === "forbidden" ? "Forbidden" : "Unauthorized" }, { status: auth.error === "forbidden" ? 403 : 401 });
  }
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ error: "Expected a multipart upload." }, { status: 415 });
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > 65 * 1024 * 1024) {
    return NextResponse.json({ error: "Upload exceeds the 60 MB limit." }, { status: 413 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind") === "IMAGE" ? "IMAGE" : "VIDEO";
    if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
    const media = await storeUploadedFile(file, kind, auth.user.id);
    await audit({
      actor: auth.user,
      action: "media.uploaded",
      targetType: "uploaded_media",
      targetId: media.id,
      metadata: { kind, sizeBytes: media.sizeBytes, mimeType: media.mimeType },
    });
    return NextResponse.json({ id: media.id, url: media.url, sizeBytes: media.sizeBytes, kind: media.kind });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed." },
      { status: 400 },
    );
  }
}
