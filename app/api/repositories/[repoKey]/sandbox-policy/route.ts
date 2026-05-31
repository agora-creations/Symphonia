import { jsonBody, proxyToSymphoniaService } from "@/lib/server/symphonia-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ repoKey: string }> },
) {
  const { repoKey } = await params;
  return proxyToSymphoniaService(
    `/api/repositories/${encodeURIComponent(repoKey)}/sandbox-policy`,
    {},
    request,
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ repoKey: string }> },
) {
  const { repoKey } = await params;
  return proxyToSymphoniaService(
    `/api/repositories/${encodeURIComponent(repoKey)}/sandbox-policy`,
    {
      method: "POST",
      body: await jsonBody(request),
    },
    request,
  );
}
