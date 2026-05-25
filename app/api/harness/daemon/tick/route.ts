import { proxyToSymphoniaService } from "@/lib/server/symphonia-service";

export const runtime = "nodejs";

export async function POST() {
  return proxyToSymphoniaService("/api/harness/daemon/tick", { method: "POST" });
}
