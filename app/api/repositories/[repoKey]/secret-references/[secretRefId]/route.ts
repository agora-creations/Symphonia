import { proxyToSymphoniaService } from "@/lib/server/symphonia-service";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ repoKey: string; secretRefId: string }> },
) {
  const { repoKey, secretRefId } = await params;

  return proxyToSymphoniaService(
    `/api/repositories/${encodeURIComponent(repoKey)}/secret-references/${encodeURIComponent(
      secretRefId,
    )}`,
    { method: "DELETE" },
    request,
  );
}
