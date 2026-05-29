import { proxyToSymphoniaService } from "@/lib/server/symphonia-service";

export async function POST() {
  return proxyToSymphoniaService("/api/harness/reconcile", { method: "POST" });
}
