import Config

# The end-to-end environment: a real HTTP server against a database of its own,
# driven by the Playwright suite in frontend/e2e. It uses a normal connection
# pool rather than the SQL sandbox, because the separate requests of a browser
# must see each other's committed writes. POST /test/reset empties the database
# between tests.
#
# Each Playwright worker starts its own backend with its own E2E_WORKER index,
# which gives it its own database and port.
worker = String.to_integer(System.get_env("E2E_WORKER", "0"))

config :richard_burton,
  # The worker's frontend, which CORS allows (see
  # `RichardBurton.Application.origin/0`). An environment variable
  # PHX_CONSUMER_URL takes precedence.
  phx_consumer_url: "http://localhost:#{3100 + worker}",
  # The frontend and the backend are on different origins, so CORS must allow
  # credentials for the requests to carry the rb-session cookie.
  phx_cors_credentials: true,
  # The browser talks to the backend over plain HTTP.
  phx_session_tls: false,
  # No network calls. The JWKS provider is a stub, because tests sign in
  # through RichardBurtonWeb.DevSessionController. Swoosh.Adapters.Test sends
  # each email as a message to the process that delivers it, not over SMTP.
  jwks_provider: RichardBurton.Auth.JWKS.Stub,
  mailer_adapter: Swoosh.Adapters.Test

# Rebuild the search index before the write returns, so tests see writes
# straight away, with CONCURRENTLY, as production's debounced strategy does.
config :richard_burton, search_index_refresh: :sync_concurrent

config :richard_burton, RichardBurton.Repo,
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  database: "richard_burton_e2e#{worker}",
  pool_size: 10

config :richard_burton, RichardBurtonWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4100 + worker],
  secret_key_base: "JVyOD7tvII62MK/o0JNJVbc7uHoYh4QfruGgKs9H/Y/NyurQ2lXCBF3sSNEctLFi",
  server: true

config :logger, level: :warning
config :phoenix, :plug_init_mode, :runtime

# More publications than the seeded corpus, so a test that is not about paging
# never reaches the end of a page. The test that is about paging seeds more.
config :richard_burton, publications_per_page: 20
