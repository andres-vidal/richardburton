defmodule RichardBurton.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc """
  Starts the platform's supervision tree, after copying configured values into
  the environment variables that are unset.
  """

  use Application

  # The environment variables the platform reads at run time. Each one that is
  # unset takes the value of the application setting named by its lowercase
  # name, such as `:smtp_host` for `SMTP_HOST`, when that setting has one.
  @env_vars [
    "PHX_CONSUMER_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_OPENID_CONFIG_URL",
    "GOOGLE_OAUTH2_CERTS_URL",
    "GOOGLE_RECAPTCHA_VERIFICATION_URL",
    "GOOGLE_RECAPTCHA_SECRET_KEY",
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_PORT",
    "SMTP_FROM",
    "SMTP_NAME",
    "SMTP_TLS",
    "SMTP_ADMIN_INBOX"
  ]

  @impl true
  def start(_type, _args) do
    children = [
      # Start the Ecto repository
      RichardBurton.Repo,
      # Start the Telemetry supervisor
      RichardBurtonWeb.Telemetry,
      # Start the PubSub system
      {Phoenix.PubSub, name: RichardBurton.PubSub},
      # Tracks who has each import document open.
      RichardBurtonWeb.Presence,
      # Start the Endpoint (http/https)
      RichardBurtonWeb.Endpoint,
      # Caches the JWKS signing keys of the provider set by `:jwks_provider`.
      RichardBurton.Auth.KeyStore,
      # Coalesces the search-index refresh signals of the write paths, when
      # refreshes are debounced.
      RichardBurton.Publication.Index.Refresher
    ]

    for name <- @env_vars,
        is_nil(System.get_env(name)),
        value =
          Application.get_env(:richard_burton, name |> String.downcase() |> String.to_atom()),
        not is_nil(value) do
      System.put_env(name, to_string(value))
    end

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: RichardBurton.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    RichardBurtonWeb.Endpoint.config_change(changed, removed)
    :ok
  end

  @doc """
  Returns `PHX_CONSUMER_URL`, the only origin cross-origin requests are
  allowed from. Raises when it is unset.
  """
  def origin do
    System.get_env("PHX_CONSUMER_URL") ||
      raise "environment variable PHX_CONSUMER_URL not set"
  end
end
