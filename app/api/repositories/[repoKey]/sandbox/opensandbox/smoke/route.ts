import { jsonBody, proxyToSymphoniaService } from "@/lib/server/symphonia-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ repoKey: string }> },
) {
  const { repoKey } = await params;
  return proxyToSymphoniaService(
    `/api/repositories/${encodeURIComponent(repoKey)}/sandbox/opensandbox/smoke`,
    {
      method: "POST",
      body: await jsonBody(request),
    },
    request,
  );
}
