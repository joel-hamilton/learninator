import type { ProfileStore, ProfileReportRow } from "../types.js";

interface EndpointProfile {
  routePattern: string;
  count: number;
  totalMs: number;
  minMs: number;
  maxMs: number;
  recentSlow: { url: string; durationMs: number }[];
}

function isProfileEnabled(): boolean {
  const v = process.env.PROFILE;
  return v === "1" || v === "true" || v === "yes";
}

export function createProfileStore(): ProfileStore {
  const entries = new Map<string, EndpointProfile>();
  const MAX_ENTRIES = 500;
  const MAX_SLOW = 10;

  function record(
    method: string,
    routePattern: string,
    durationMs: number,
    url: string,
  ): void {
    if (!isProfileEnabled()) return;

    const key = `${method}:${routePattern}`;
    let entry = entries.get(key);

    if (!entry) {
      entry = {
        routePattern: key,
        count: 0,
        totalMs: 0,
        minMs: Infinity,
        maxMs: -Infinity,
        recentSlow: [],
      };
      entries.set(key, entry);
    }

    entry.count++;
    entry.totalMs += durationMs;
    if (durationMs < entry.minMs) entry.minMs = durationMs;
    if (durationMs > entry.maxMs) entry.maxMs = durationMs;

    // Insert into recentSlow ring buffer, keeping it sorted slowest-first
    const slow: typeof entry.recentSlow = entry.recentSlow;
    slow.push({ url, durationMs });
    slow.sort((a, b) => b.durationMs - a.durationMs);
    if (slow.length > MAX_SLOW) slow.length = MAX_SLOW;

    // Evict least-frequent entries if over capacity
    if (entries.size > MAX_ENTRIES) {
      let minKey = "";
      let minCount = Infinity;
      for (const [k, e] of entries) {
        if (e.count < minCount) {
          minCount = e.count;
          minKey = k;
        }
      }
      if (minKey) entries.delete(minKey);
    }
  }

  function generateReport(): ProfileReportRow[] {
    const rows: ProfileReportRow[] = [];
    for (const [, entry] of entries) {
      rows.push({
        routePattern: entry.routePattern,
        count: entry.count,
        avgMs: entry.count > 0 ? entry.totalMs / entry.count : 0,
        minMs: entry.minMs === Infinity ? 0 : entry.minMs,
        maxMs: entry.maxMs === -Infinity ? 0 : entry.maxMs,
        recentSlow: entry.recentSlow,
      });
    }
    // Sort by total time descending (busiest endpoints first)
    rows.sort((a, b) => {
      const totalB = b.avgMs * b.count;
      const totalA = a.avgMs * a.count;
      return totalB - totalA;
    });
    return rows;
  }

  function isEnabled(): boolean {
    return isProfileEnabled();
  }

  function printShutdownSummary(): void {
    if (!isProfileEnabled() || entries.size === 0) return;

    const rows = generateReport();
    console.log("\n── Profile Summary (since server start) ──");
    console.log(
      "Endpoint".padEnd(40),
      "Count".padStart(8),
      "Avg".padStart(10),
      "Min".padStart(10),
      "Max".padStart(10),
    );
    for (const r of rows) {
      console.log(
        r.routePattern.padEnd(40),
        String(r.count).padStart(8),
        `${r.avgMs.toFixed(1)}ms`.padStart(10),
        `${r.minMs.toFixed(1)}ms`.padStart(10),
        `${r.maxMs.toFixed(1)}ms`.padStart(10),
      );
    }
    console.log("── End Profile Summary ──\n");
  }

  // Register shutdown handler for the summary
  if (isProfileEnabled()) {
    process.on("exit", printShutdownSummary);
    // Also catch SIGINT/SIGTERM for graceful shutdown
    const shutdown = () => {
      printShutdownSummary();
      process.exit(0);
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }

  return { record, generateReport, isEnabled };
}
