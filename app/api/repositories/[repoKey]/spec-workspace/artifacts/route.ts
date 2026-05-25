import { proxyToSymphoniaService } from "@/lib/server/symphonia-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ repoKey: string }> },
) {
  const { repoKey } = await params;
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const query = type ? `?type=${encodeURIComponent(type)}` : "";

  return proxyToSymphoniaService(
    `/api/repositories/${encodeURIComponent(repoKey)}/spec-workspace/artifacts${query}`,
  );
}
