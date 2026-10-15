import Config

import_config "prod.local.exs"

# Do not print debug messages in production
config :logger, level: :info
