import { jsonBody, proxyToSymphoniaService } from "@/lib/server/symphonia-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runnerId: string; assignmentId: string }> },
) {
  const { runnerId, assignmentId } = await params;

  return proxyToSymphoniaService(
    `/api/runners/${encodeURIComponent(runnerId)}/assignments/${encodeURIComponent(
      assignmentId,
    )}/events`,
    {
      method: "POST",
      body: await jsonBody(request),
    },
    request,
  );
}
