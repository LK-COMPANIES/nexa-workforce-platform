import { runWithRequestContext } from "./request-context";
import { StructuredLoggerService } from "./structured-logger.service";

function captureStdout(): { output: string[]; restore: () => void } {
  const output: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string) => {
    output.push(chunk);
    return true;
  }) as typeof process.stdout.write;
  return { output, restore: () => (process.stdout.write = original) };
}

function captureStderr(): { output: string[]; restore: () => void } {
  const output: string[] = [];
  const original = process.stderr.write.bind(process.stderr);
  process.stderr.write = ((chunk: string) => {
    output.push(chunk);
    return true;
  }) as typeof process.stderr.write;
  return { output, restore: () => (process.stderr.write = original) };
}

describe("StructuredLoggerService", () => {
  it("writes log() as a JSON line to stdout with the expected fields", () => {
    const capture = captureStdout();
    try {
      new StructuredLoggerService().log("hello world", "SomeContext");
    } finally {
      capture.restore();
    }
    expect(capture.output).toHaveLength(1);
    const entry = JSON.parse(capture.output[0]!);
    expect(entry.level).toBe("log");
    expect(entry.message).toBe("hello world");
    expect(entry.context).toBe("SomeContext");
    expect(entry.timestamp).toEqual(expect.any(String));
  });

  it("writes error() and warn() to stderr, not stdout", () => {
    const stdout = captureStdout();
    const stderr = captureStderr();
    try {
      new StructuredLoggerService().error("boom");
      new StructuredLoggerService().warn("careful");
    } finally {
      stdout.restore();
      stderr.restore();
    }
    expect(stdout.output).toHaveLength(0);
    expect(stderr.output).toHaveLength(2);
  });

  it("captures Nest's (message, stack, context) convention for error()", () => {
    const capture = captureStderr();
    try {
      new StructuredLoggerService().error("Something failed", "Error: boom\n  at foo.ts:1:1", "MyService");
    } finally {
      capture.restore();
    }
    const entry = JSON.parse(capture.output[0]!);
    expect(entry.message).toBe("Something failed");
    expect(entry.stack).toBe("Error: boom\n  at foo.ts:1:1");
    expect(entry.context).toBe("MyService");
  });

  it("includes requestId/organizationId/userId when a request context is active", () => {
    const capture = captureStdout();
    let entry: Record<string, unknown> = {};
    try {
      runWithRequestContext({ requestId: "req-42", organizationId: "org-1", userId: "user-1" }, () => {
        new StructuredLoggerService().log("scoped message");
      });
      entry = JSON.parse(capture.output[0]!);
    } finally {
      capture.restore();
    }
    expect(entry.requestId).toBe("req-42");
    expect(entry.organizationId).toBe("org-1");
    expect(entry.userId).toBe("user-1");
  });

  it("omits requestId/organizationId/userId cleanly (undefined) outside any request context", () => {
    const capture = captureStdout();
    let entry: Record<string, unknown> = {};
    try {
      new StructuredLoggerService().log("unscoped message");
      entry = JSON.parse(capture.output[0]!);
    } finally {
      capture.restore();
    }
    expect(entry.requestId).toBeUndefined();
  });

  it("stringifies a non-string message rather than throwing", () => {
    const capture = captureStdout();
    let entry: Record<string, unknown> = {};
    try {
      new StructuredLoggerService().log({ some: "object" });
      entry = JSON.parse(capture.output[0]!);
    } finally {
      capture.restore();
    }
    expect(entry.message).toBe('{"some":"object"}');
  });
});
