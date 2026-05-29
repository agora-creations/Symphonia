import { proxyToSymphoniaService } from "@/lib/server/symphonia-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return proxyToSymphoniaService("/api/coding-assistants/providers");
}
