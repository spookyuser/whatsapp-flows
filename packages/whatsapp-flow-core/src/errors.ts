/** A compile error written for a developer, optionally scoped to a screen route
 * and/or component. Collected and reported by the CLI. */
export class FlowCompileError extends Error {
  readonly route?: string;
  readonly component?: string;

  constructor(message: string, opts: { route?: string; component?: string } = {}) {
    super(message);
    this.name = "FlowCompileError";
    this.route = opts.route;
    this.component = opts.component;
  }
}

/** Aggregate multiple compile errors into one thrown error with a readable list. */
export class FlowCompileErrors extends Error {
  readonly errors: FlowCompileError[];

  constructor(errors: FlowCompileError[]) {
    const body = errors
      .map((e) => `  - ${e.route ? `[${e.route}] ` : ""}${e.message}`)
      .join("\n");
    super(`Flow compilation failed with ${errors.length} error(s):\n${body}`);
    this.name = "FlowCompileErrors";
    this.errors = errors;
  }
}
