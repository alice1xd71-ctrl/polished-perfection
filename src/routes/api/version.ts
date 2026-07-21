import { createFileRoute } from "@tanstack/react-router";

declare const __APP_COMMIT__: string | undefined;
declare const __APP_BUILD_TIME__: string | undefined;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
} as const;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export const Route = createFileRoute("/api/version")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async () => {
        const runtimeCommit =
          process.env.GIT_COMMIT_SHA ??
          process.env.COMMIT_SHA ??
          process.env.CF_PAGES_COMMIT_SHA ??
          process.env.VERCEL_GIT_COMMIT_SHA ??
          null;

        return json({
          commit: runtimeCommit ?? __APP_COMMIT__ ?? "unknown",
          build: __APP_BUILD_TIME__ ?? "unknown",
        });
      },
    },
  },
});