import Config

config :richard_burton,
  # The frontend origin that CORS allows (see RichardBurton.Application.origin/0).
  phx_consumer_url: "http://localhost:3000",
  # The key store runs in all environments; under test it uses a no-op JWKS
  # provider so it makes no network calls (auth itself is mocked via Mox).
  jwks_provider: RichardBurton.Auth.JWKS.Stub,
  # Send built emails to the calling process instead of opening an SMTP
  # connection (see RichardBurton.Mailer).
  mailer_adapter: Swoosh.Adapters.Test

# Who mail is from, and where the contact form's mail goes. The mailer reads
# them from the environment when it builds an email.
System.put_env("SMTP_NAME", "Richard & Isabel Burton Platform")
System.put_env("SMTP_FROM", "no-reply@richardburton.test")
System.put_env("SMTP_ADMIN_INBOX", "inbox@richardburton.test")

# Rebuild the search index inline (plain REFRESH): tests need writes visible to
# search immediately, and the sandbox's transactions forbid CONCURRENTLY.
config :richard_burton, search_index_refresh: :sync

# Configure your database
#
# The MIX_TEST_PARTITION environment variable can be used
# to provide built-in test partitioning in CI environment.
# Run `mix help test` for more information.
config :richard_burton, RichardBurton.Repo,
  username: "postgres",
  password: "postgres",
  hostname: "localhost",
  database: "richard_burton_test#{System.get_env("MIX_TEST_PARTITION")}",
  pool: Ecto.Adapters.SQL.Sandbox,
  pool_size: 10

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :richard_burton, RichardBurtonWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "JVyOD7tvII62MK/o0JNJVbc7uHoYh4QfruGgKs9H/Y/NyurQ2lXCBF3sSNEctLFi",
  server: false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# A page small enough that a fixture can reach the end of one.
config :richard_burton, publications_per_page: 5
