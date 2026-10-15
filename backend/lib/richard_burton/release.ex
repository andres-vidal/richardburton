defmodule RichardBurton.Release do
  @moduledoc """
  Database tasks for a release, which runs without Mix.
  """
  @app :richard_burton

  @doc "Runs every pending migration of every repo."
  def migrate do
    load_app()

    for repo <- repos() do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :up, all: true))
    end
  end

  @doc "Rolls `repo` back to the migration `version`."
  def rollback(repo, version) do
    load_app()
    {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :down, to: version))
  end

  # The repos to migrate, read from config rather than named here.
  defp repos do
    Application.fetch_env!(@app, :ecto_repos)
  end

  # Loads the application without starting it, so migrations can run before the
  # supervision tree does.
  defp load_app do
    Application.load(@app)
  end
end
