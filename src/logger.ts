function isDebugEnabled(): boolean {
  const v = process.env.DEBUG;
  return v === "1" || v === "true" || v === "yes";
}

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

function timestamp(): string {
  return new Date().toISOString();
}

function prefix(ns: string, reqId?: string): string {
  const req = reqId ? ` [req:${reqId}]` : "";
  return `[${ns}]${req}`;
}

export function createLogger(namespace: string, requestId?: string): Logger {
  const label = prefix(namespace, requestId);
  return {
    debug(...args: unknown[]) {
      if (isDebugEnabled()) console.log(timestamp(), label, ...args);
    },
    info(...args: unknown[]) {
      console.log(timestamp(), label, ...args);
    },
    warn(...args: unknown[]) {
      console.warn(timestamp(), label, ...args);
    },
    error(...args: unknown[]) {
      console.error(timestamp(), label, ...args);
    },
  };
}
