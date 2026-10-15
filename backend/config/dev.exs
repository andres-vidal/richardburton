import Config

config :richard_burton,
  # The frontend origin that CORS allows (see RichardBurton.Application.origin/0).
  phx_consumer_url: "http://localhost:3000",
  # Local dev is plain HTTP, so the session cookie can't require TLS (Secure).
  phx_session_tls: false,
  # Dev frontend (:3000) and backend (:4000) are cross-origin, so the browser
  # needs CORS credentials to send the rb-session cookie.
  phx_cors_credentials: true

# Mail stays on this machine: Swoosh.Adapters.Local keeps what would have been
# sent in memory, and http://localhost:4000/dev/mailbox lists it. Inviting a
# real address from a development database then sends nothing to a real inbox.
config :richard_burton, mailer_adapter: Swoosh.Adapters.Local

# Who that mail is from. Not a secret, and the mailbox needs an address to
# show; override in dev.local.exs, along with the adapter, to send for real.
System.put_env("SMTP_NAME", "Richard & Isabel Burton Platform")
System.put_env("SMTP_FROM", "no-reply@localhost")

# The local settings and secrets, such as the Google client id. The file is not
# tracked, and the backend runs without it.
if File.exists?(Path.join(__DIR__, "dev.local.exs")), do: import_config("dev.local.exs")

# Configure your database
config :richard_burton, RichardBurton.Repo,
  username: System.get_env("PGUSER", "postgres"),
  password: System.get_env("PGPASSWORD", "postgres"),
  hostname: System.get_env("PGHOST", "localhost"),
  database: System.get_env("PGDATABASE", "richard_burton_dev"),
  stacktrace: true,
  show_sensitive_data_on_connection_error: true,
  pool_size: 10

config :richard_burton, RichardBurtonWeb.Endpoint,
  http: [:inet6, port: 4000],
  code_reloader: true,
  secret_key_base: "WFkOQxggFrvLxxLc2Eaw4huoo1ncbDpVoDXHJPLI+rqrEF8OOmuN0xXqv1lBzZ5I"

# Do not include metadata nor timestamps in development logs
config :logger, :default_formatter, format: "[$level] $message\n"

# Set a higher stacktrace during development. Avoid configuring such
# in production as building large stacktraces may be expensive.
config :phoenix, :stacktrace_depth, 20

# Initialize plugs at runtime for faster development compilation
config :phoenix, :plug_init_mode, :runtime
