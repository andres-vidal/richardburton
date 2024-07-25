defmodule RichardBurton.MixProject do
  use Mix.Project

  def project do
    [
      app: :richard_burton,
      version: "0.1.0",
      elixir: "~> 1.16",
      elixirc_paths: elixirc_paths(Mix.env()),
      compilers: Mix.compilers(),
      start_permanent: Mix.env() == :prod,
      aliases: aliases(),
      deps: deps()
    ]
  end

  # Configuration for the OTP application.
  #
  # Type `mix help compile.app` for more information.
  def application do
    [
      mod: {RichardBurton.Application, []},
      extra_applications: [:logger, :runtime_tools]
    ]
  end

  # Specifies which paths to compile per environment.
  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  # Specifies your project dependencies.
  #
  # Type `mix help deps` for examples and options.
  defp deps do
    [
      {:cors_plug, "~> 3.0.3"},
      {:countries, "~> 1.6.0"},
      {:credo, "~> 1.7.5", only: [:dev, :test], runtime: false},
      {:csv, "~> 3.2.1"},
      {:ecto_commons, "~> 0.3.4"},
      {:ecto_sql, "~> 3.11.1"},
      {:ex_doc, "~> 0.31.2", only: :dev, runtime: false},
      {:faker, "~> 0.18", runtime: false},
      {:gen_smtp, "1.2.0"},
      {:httpoison, "~> 2.2.1"},
      {:jason, "~> 1.4.1"},
      {:joken, "~> 2.6.0"},
      {:mox, "~> 1.1.0", only: :test},
      {:phoenix, "~> 1.7.11"},
      {:phoenix_ecto, "~> 4.5.1"},
      {:phoenix_live_dashboard, "~> 0.8.3"},
      {:phoenix_view, "~> 2.0.3"},
      {:plug, "~> 1.15.3"},
      {:plug_cowboy, "~> 2.7.0"},
      {:postgrex, "~> 0.17.5"},
      {:ssl_verify_fun, "~> 1.1.7"},
      {:swoosh, "~> 1.16.1"},
      {:telemetry_metrics, "~> 0.6.2"},
      {:telemetry_poller, "~> 1.0.0"}
    ]
  end

  # Aliases are shortcuts or tasks specific to the current project.
  # For example, to install project dependencies and perform other setup tasks, run:
  #
  #     $ mix setup
  #
  # See the documentation for `Mix` for more info on aliases.
  defp aliases do
    [
      setup: ["deps.get", "ecto.setup"],
      "ecto.setup": ["ecto.create", "ecto.migrate", "run priv/repo/seeds.exs"],
      "ecto.reset": ["ecto.drop", "ecto.setup"],
      test: ["ecto.create --quiet", "ecto.migrate --quiet", "test"]
    ]
  end
end
