import { execFileSync } from "node:child_process";
import { MIX_PATH, WORKERS } from "./stack";

/**
 * Creates and migrates each worker's database before Playwright starts the
 * stacks. A database that already exists is migrated as it is.
 */
export default function globalSetup() {
  for (let i = 0; i < WORKERS; i++) {
    const env = {
      ...process.env,
      MIX_ENV: "e2e",
      E2E_WORKER: String(i),
      PATH: MIX_PATH,
    };
    const opts = { cwd: "../backend", env } as const;

    try {
      execFileSync("mix", ["ecto.create", "--quiet"], {
        ...opts,
        stdio: "pipe",
      });
    } catch {
      // The database exists already.
    }
    execFileSync("mix", ["ecto.migrate", "--quiet"], {
      ...opts,
      stdio: "inherit",
    });
  }
}
