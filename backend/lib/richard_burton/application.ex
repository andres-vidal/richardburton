defmodule RichardBurton.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      # Start the Ecto repository
      RichardBurton.Repo,
      # Start the Telemetry supervisor
      RichardBurtonWeb.Telemetry,
      # Start the PubSub system
      {Phoenix.PubSub, name: RichardBurton.PubSub},
      # Start the Endpoint (http/https)
      RichardBurtonWeb.Endpoint,
      # Start the JWKS key store. Its provider is configured via :jwks_provider
      # (Google in dev/prod; a stub under test, so no network calls are made).
      RichardBurton.Auth.KeyStore
    ]

    # Set missing runtime config from Application env
    [
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
    |> Enum.map(&{&1, &1 |> String.downcase() |> String.to_atom()})
    |> Enum.filter(fn {key, _} -> is_nil(System.get_env(key)) end)
    |> Enum.reject(fn {_, key} -> is_nil(Application.get_env(:richard_burton, key)) end)
    |> Enum.map(fn {k1, k2} -> {k1, Application.get_env(:richard_burton, k2)} end)
    |> System.put_env()

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

  def origin do
    System.get_env("PHX_CONSUMER_URL") ||
      raise "environment variable PHX_CONSUMER_URL not set"
  end
end
