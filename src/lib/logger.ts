type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  businessId?: string;
  appointmentId?: string;
  [key: string]: unknown;
}

function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function createLogFn(level: LogLevel) {
  return (message: string, meta?: Record<string, unknown>) => {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...meta,
    };
    if (level === "error") {
      console.error(formatLog(entry));
    } else if (level === "warn") {
      console.warn(formatLog(entry));
    } else {
      console.log(formatLog(entry));
    }
  };
}

export const logger = {
  info: createLogFn("info"),
  warn: createLogFn("warn"),
  error: createLogFn("error"),
  debug: createLogFn("debug"),
};
