defmodule RichardBurtonWeb.E2EResetController do
  @moduledoc """
  Empties the database between end-to-end tests: it truncates every table but
  the migration ledger, restarts the identity sequences, and refreshes the
  search index.

  Each end-to-end worker has a database of its own, so a reset empties only
  the database of the worker that asks for it.
  """
  use RichardBurtonWeb, :controller

  alias RichardBurton.Publication.Index.Refresher
  alias RichardBurton.Repo

  # The tables a reset keeps.
  @preserved ["schema_migrations"]

  @doc """
  Truncates every table but `schema_migrations`, refreshes the search index,
  and responds with a 204.

  `TRUNCATE` does not empty the materialized views the index reads, so the
  reset refreshes them the way a write does. In the e2e environment the
  refresh finishes before `Refresher.refresh/0` returns, so the next request
  reads an empty index.
  """
  def create(conn, _params) do
    tables =
      Repo.query!(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> ALL($1)",
        [@preserved]
      ).rows
      |> List.flatten()

    quoted = Enum.map_join(tables, ", ", &~s("#{&1}"))
    Repo.query!("TRUNCATE TABLE #{quoted} RESTART IDENTITY CASCADE")
    Refresher.refresh()

    send_resp(conn, :no_content, "")
  end
end
