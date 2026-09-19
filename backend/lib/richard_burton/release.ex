defmodule RichardBurton.Release do
  @moduledoc """
  Used for executing DB release tasks when run in production without Mix
  installed.
  """
  @app :richard_burton

  def migrate do
    load_app()

    for repo <- repos() do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :up, all: true))
    end
  end

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
