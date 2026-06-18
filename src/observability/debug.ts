import type { MiddlewareHandler } from "hono";
import { createLogger } from "../logger.js";
import crypto from "node:crypto";
import type { ProfileStore } from "../types.js";

function isDebugEnabled(): boolean {
  const v = process.env.DEBUG;
  return v === "1" || v === "true" || v === "yes";
}

function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}

function elapsedMs(start: bigint): string {
  const ns = Number(process.hrtime.bigint() - start);
  return `${(ns / 1e6).toFixed(2)}ms`;
}

function elapsedMsNum(start: bigint): number {
  const ns = Number(process.hrtime.bigint() - start);
  return ns / 1e6;
}

/** Generates a request ID and sets X-Request-ID header. */
export function requestIdMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    if (!isDebugEnabled()) return next();

    const requestId = generateRequestId();
    c.set("logger", createLogger("http", requestId));
    c.header("X-Request-ID", requestId);
    await next();
  };
}

/** Times request phases, emits debug log lines, and records profile stats. */
export function timingMiddleware(profileStore: ProfileStore | null): MiddlewareHandler {
  return async (c, next) => {
    const debugOn = isDebugEnabled();
    const profileOn = profileStore?.isEnabled();

    if (!debugOn && !profileOn) {
      // Even without debug/profile, log a basic info line like the old middleware did
      const logger = c.get("logger");
      const method = c.req.method;
      const path = c.req.path;
      const start = Date.now();
      await next();
      const ms = Date.now() - start;
      logger.info(`${method} ${path} — ${c.res.status} (${ms}ms)`);
      return;
    }

    const start = process.hrtime.bigint();
    const logger = c.get("logger");
    const method = c.req.method;
    const path = c.req.path;

    // Always emit a minimal info line so the terminal shows request activity
    const wallStart = Date.now();

    if (debugOn) {
      logger.debug(`→ ${method} ${path} (0ms)`, "request-received");
      logger.debug(`handler-start ${method} ${path} (${elapsedMs(start)})`);
    }

    const handlerStart = process.hrtime.bigint();

    await next();

    const handlerDuration = elapsedMsNum(handlerStart);
    const wallMs = Date.now() - wallStart;
    logger.info(`${method} ${path} — ${c.res.status} (${wallMs}ms)`);

    // Check if the response body is a ReadableStream (SSE, etc.)
    const res = c.res;
    const body = res?.body;
    const isStream = body instanceof ReadableStream;

    if (isStream) {
      // Wrap the stream to capture when it completes
      const originalStream = body as ReadableStream;
      const streamStart = process.hrtime.bigint();

      if (debugOn) {
        logger.debug(
          `handler-end ${method} ${path} (${handlerDuration.toFixed(2)}ms)`,
        );
        logger.debug(
          `stream-start ${method} ${path} — handler ${handlerDuration.toFixed(2)}ms`,
        );
      }

      let streamEndLogged = false;

      const wrappedStream = new ReadableStream({
        async start(controller) {
          const reader = originalStream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }

            if (!streamEndLogged) {
              streamEndLogged = true;
              const streamDuration = elapsedMsNum(streamStart);
              const totalDuration = elapsedMsNum(start);

              if (debugOn) {
                logger.debug(
                  `stream-end ${method} ${path} — ${streamDuration.toFixed(2)}ms stream, ${totalDuration.toFixed(2)}ms total`,
                );
              }

              checkDiscrepancy(logger, method, path, handlerDuration, totalDuration);
            }

            controller.close();
          } catch (err) {
            controller.error(err);
          }
        },
        cancel() {
          if (!streamEndLogged) {
            streamEndLogged = true;
            const streamDuration = elapsedMsNum(streamStart);
            const totalDuration = elapsedMsNum(start);

            if (debugOn) {
              logger.debug(
                `stream-end ${method} ${path} — ${streamDuration.toFixed(2)}ms stream (cancelled), ${totalDuration.toFixed(2)}ms total`,
              );
            }
          }
          return originalStream.cancel();
        },
      });

      // Replace the response with the wrapped stream
      c.res = new Response(wrappedStream, {
        status: res.status,
        headers: res.headers,
      });
    } else {
      // Non-streaming: response is fully materialized
      const totalDuration = elapsedMsNum(start);

      if (debugOn) {
        logger.debug(
          `handler-end ${method} ${path} (${handlerDuration.toFixed(2)}ms)`,
        );
        logger.debug(
          `response-sent ${method} ${path} (${totalDuration.toFixed(2)}ms)`,
        );
      }

      checkDiscrepancy(logger, method, path, handlerDuration, totalDuration);
    }

    // Record profile data (routePath is available after the route matched)
    const profileDispatcher = profileStore; // capture non-null for TS
    if (profileOn && profileDispatcher) {
      const routePattern = c.req.routePath || path;
      const totalDuration = elapsedMsNum(start);
      profileDispatcher.record(method, routePattern, totalDuration, path);
    }
  };
}

function checkDiscrepancy(
  logger: ReturnType<typeof createLogger>,
  method: string,
  path: string,
  handlerDuration: number,
  totalDuration: number,
): void {
  const gap = totalDuration - handlerDuration;

  // Only warn when the numbers are meaningful:
  // - handler took at least 10ms (below that, overhead ratios are noise)
  // - gap exceeds 5x the handler time
  if (handlerDuration >= 10 && gap > handlerDuration * 5) {
    logger.warn(
      `timing-discrepancy ${method} ${path} — handler ${handlerDuration.toFixed(2)}ms, total ${totalDuration.toFixed(2)}ms ` +
        `(gap ${gap.toFixed(2)}ms, ${(gap / handlerDuration).toFixed(0)}x). ` +
        `Client-perceived latency may differ due to streaming or connection factors.`,
    );
  }
}
