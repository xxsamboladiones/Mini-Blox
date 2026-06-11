type LogLevel = "debug" | "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const configuredLevel = normalizeLogLevel(process.env.LOG_LEVEL);

export const logger = {
  debug(message: string, context: LogContext = {}): void {
    writeLog("debug", message, context);
  },

  info(message: string, context: LogContext = {}): void {
    writeLog("info", message, context);
  },

  warn(message: string, context: LogContext = {}): void {
    writeLog("warn", message, context);
  },

  error(message: string, context: LogContext = {}): void {
    writeLog("error", message, context);
  },
};

function writeLog(level: LogLevel, message: string, context: LogContext): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[configuredLevel]) {
    return;
  }

  const payload = {
    level,
    time: new Date().toISOString(),
    message,
    ...sanitizeContext(context),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

function sanitizeContext(context: LogContext): LogContext {
  const clean: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("authorization")
    ) {
      clean[key] = "[redacted]";
      continue;
    }

    if (value instanceof Error) {
      clean[key] = {
        name: value.name,
        message: value.message,
        stack: process.env.NODE_ENV === "production" ? undefined : value.stack,
      };
      continue;
    }

    clean[key] = value;
  }

  return clean;
}

function normalizeLogLevel(value: string | undefined): LogLevel {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  return "info";
}
