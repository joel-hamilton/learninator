const DEBUG = process.env.DEBUG === "true" || process.env.DEBUG === "1";

export interface Logger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

function prefix(ns: string): string {
  return `[${ns}]`;
}

export function createLogger(namespace: string): Logger {
  return {
    debug(...args: unknown[]) {
      if (DEBUG) console.log(prefix(namespace), ...args);
    },
    info(...args: unknown[]) {
      console.log(prefix(namespace), ...args);
    },
    warn(...args: unknown[]) {
      console.warn(prefix(namespace), ...args);
    },
    error(...args: unknown[]) {
      console.error(prefix(namespace), ...args);
    },
  };
}
