import Config

# Settings for a production build on this machine. The file is not tracked, and
# a build runs without it; deployments configure the app at runtime instead
# (see runtime.exs).
if File.exists?(Path.join(__DIR__, "prod.local.exs")), do: import_config("prod.local.exs")

# Do not print debug messages in production
config :logger, level: :info
