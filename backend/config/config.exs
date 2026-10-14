# The configuration shared by every environment. The file of the environment,
# imported at the bottom, overrides it.
import Config

config :richard_burton,
  ecto_repos: [RichardBurton.Repo]

# Search-index maintenance strategy (see Publication.Index.Refresher): rebuild
# the materialized views once per burst of writes, concurrently, off the write
# path. Test and e2e override this with synchronous strategies for determinism.
config :richard_burton, search_index_refresh: {:debounced, 2_000}

config :richard_burton, RichardBurton.Repo,
  timeout: String.to_integer(System.get_env("POSTGREX_TIMEOUT", "15000"))

config :richard_burton, RichardBurtonWeb.Endpoint,
  url: [host: "localhost"],
  render_errors: [
    formats: [json: RichardBurtonWeb.ErrorJSON],
    layout: false
  ],
  pubsub_server: RichardBurton.PubSub,
  live_view: [signing_salt: "L5BIKL+B"]

config :logger, :default_formatter,
  format: "$time $metadata[$level] $message\n",
  metadata: [:request_id]

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
