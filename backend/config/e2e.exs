import Config

# E2E environment: a real HTTP server against a per-worker database, driven by the
# Playwright suite (see frontend/e2e). Unlike :test it uses a normal connection
# pool — committed writes must be visible across the separate HTTP requests a
# browser makes — and isolates via POST /test/reset between tests rather than a
# transactional rollback.
#
# Each Playwright worker boots its own backend with a distinct E2E_WORKER index,
# giving it an isolated database and port (the DB-per-worker isolation model).
worker = String.to_integer(System.get_env("E2E_WORKER", "0"))

config :richard_burton,
  phx_consumer_url: "http://localhost:#{3100 + worker}",
  # The browser talks to the backend cross-origin with the rb-session cookie, so
  # CORS must allow credentials (as in dev). The allowed origin itself comes from
  # the PHX_CONSUMER_URL env var (Application.origin/0), set per worker at boot.
  phx_cors_credentials: true,
  google_client_id: nil,
  google_openid_config_url: nil,
  google_oauth2_certs_url: nil,
  # No network calls: stub the JWKS provider (auth is exercised via dev sign-in)
  # and capture emails in-process instead of opening an SMTP connection.
  jwks_provider: RichardBurton.Auth.JWKS.Stub,
  mailer_adapter: Swoosh.Adapters.Test

config :richard_burton, RichardBurton.Repo,
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  database: "richard_burton_e2e#{worker}",
  # A normal pool, NOT Ecto.Adapters.SQL.Sandbox: a browser's successive requests
  # run on different connections and must see each other's committed writes.
  pool_size: 10

config :richard_burton, RichardBurtonWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4100 + worker],
  secret_key_base: "JVyOD7tvII62MK/o0JNJVbc7uHoYh4QfruGgKs9H/Y/NyurQ2lXCBF3sSNEctLFi",
  server: true

config :logger, level: :warning
config :phoenix, :plug_init_mode, :runtime
