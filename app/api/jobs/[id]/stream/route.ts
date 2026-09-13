import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobs";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = getJob(id);

  if (!job) {
    return new NextResponse("event: status\ndata: " + JSON.stringify({ status: "error", error: "Job not found." }) + "\n\n", {
      status: 404,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      function send(event: string, data: unknown) {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      function onLog(line: string) {
        send("log", line);
      }

      function onStatus() {
        send("status", { status: job!.status, error: job!.error });
        if (job!.status !== "running") {
          cleanup();
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      }

      function cleanup() {
        closed = true;
        job!.emitter.off("log", onLog);
        job!.emitter.off("status", onStatus);
      }

      for (const line of job.logs) send("log", line);

      job.emitter.on("log", onLog);
      job.emitter.on("status", onStatus);

      if (job.status !== "running") {
        onStatus();
      }

      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
