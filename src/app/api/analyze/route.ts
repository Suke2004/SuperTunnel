import { NextRequest, NextResponse } from "next/server";
import { analyzeLogsFlow } from "@/ai/genkit";

/**
 * POST /api/analyze
 *
 * Accepts VPN activity logs and returns an AI-generated analysis.
 *
 * Request body:
 *   { logs: string[], serverName?: string }
 *
 * Response:
 *   { analysis: string }
 *   or { error: string } on failure
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!Array.isArray(body?.logs) || body.logs.length === 0) {
      return NextResponse.json(
        { error: "Request body must include a non-empty 'logs' array." },
        { status: 400 }
      );
    }

    const analysis = await analyzeLogsFlow({
      logs: body.logs as string[],
      serverName: typeof body.serverName === "string" ? body.serverName : undefined,
    });

    return NextResponse.json({ analysis });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    console.error("[/api/analyze] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
