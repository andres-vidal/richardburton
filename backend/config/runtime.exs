import Config

# The configuration read from the environment when the system starts, in every
# environment and in a release.

# How alike two publications must be to be reported as duplicates. It is read
# at start rather than compiled in, so that it can be tuned against real data
# with a restart instead of a new build.
if threshold = System.get_env("DUPLICATE_THRESHOLD") do
  config :richard_burton, duplicate_threshold: String.to_float(threshold)
end

# A release runs the HTTP server only when PHX_SERVER is set. The bin/server
# script that `mix phx.gen.release` writes sets it.
if System.get_env("PHX_SERVER") do
  config :richard_burton, RichardBurtonWeb.Endpoint, server: true
end

if config_env() == :prod do
  database_url =
    System.get_env("DATABASE_URL") ||
      raise """
      environment variable DATABASE_URL is missing.
      For example: ecto://USER:PASS@HOST/DATABASE
      """

  maybe_ipv6 = if System.get_env("ECTO_IPV6"), do: [:inet6], else: []

  config :richard_burton, RichardBurton.Repo,
    url: database_url,
    pool_size: String.to_integer(System.get_env("POOL_SIZE") || "10"),
    socket_options: maybe_ipv6

  # Signs the cookies and tokens. Generate one with `mix phx.gen.secret`.
  secret_key_base =
    System.get_env("PHX_SECRET_KEY_BASE") ||
      raise """
      environment variable PHX_SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host =
    System.get_env("PHX_HOST") ||
      raise "environment variable PHX_HOST is missing"

  port =
    String.to_integer(
      System.get_env("PHX_PORT") || raise("environment variable PHX_PORT is missing")
    )

  config :richard_burton, RichardBurtonWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    # Every interface, over IPv6 and IPv4.
    http: [ip: {0, 0, 0, 0, 0, 0, 0, 0}, port: port],
    secret_key_base: secret_key_base
end
