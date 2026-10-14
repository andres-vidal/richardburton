/**
 * The stacks the E2E suite runs against. Each Playwright worker has its own
 * backend and frontend, on ports of its own, and the backend uses a database
 * of its own, `richard_burton_e2e<worker>`. The ports match those
 * backend/config/e2e.exs gives the worker.
 */

/** How many workers, and so how many stacks, run: `E2E_WORKERS`, or 1. */
export const WORKERS = Number(process.env.E2E_WORKERS ?? "1");

/** Returns the port of worker `i`'s backend. */
export const backendPort = (i: number) => 4100 + i;

/** Returns the port of worker `i`'s frontend. */
export const frontendPort = (i: number) => 3100 + i;

/** The `PATH` that finds the asdf-managed `mix` and `elixir` first. */
export const MIX_PATH = `${process.env.HOME}/.asdf/shims:${process.env.PATH}`;
