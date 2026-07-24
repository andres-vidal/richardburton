import { execFileSync } from "node:child_process";

// Ensure each worker's e2e database exists and is migrated before Playwright boots
// the stacks. Idempotent: ecto.create is tolerated if the database already exists.
export default function globalSetup() {
  const workers = Number(process.env.E2E_WORKERS ?? "1");
  const asdf = `${process.env.HOME}/.asdf/shims`;

  for (let i = 0; i < workers; i++) {
    const env = {
      ...process.env,
      MIX_ENV: "e2e",
      E2E_WORKER: String(i),
      PATH: `${asdf}:${process.env.PATH}`,
    };
    const opts = { cwd: "../backend", env } as const;

    try {
      execFileSync("mix", ["ecto.create", "--quiet"], {
        ...opts,
        stdio: "pipe",
      });
    } catch {
      // Already exists — fine.
    }
    execFileSync("mix", ["ecto.migrate", "--quiet"], {
      ...opts,
      stdio: "inherit",
    });
  }
}
