defmodule RichardBurtonWeb.E2EResetController do
  @moduledoc """
  Resets the database between Playwright tests: truncates every table, restarts
  identity sequences, and refreshes the search index. Mounted only in the :e2e
  environment (see the router). Each worker owns its own database, so a reset
  only clears that worker's data — this is what keeps parallel workers isolated.
  """
  use RichardBurtonWeb, :controller

  alias RichardBurton.Repo

  # Never truncate the migration ledger.
  @preserved ["schema_migrations"]

  def create(conn, _params) do
    tables =
      Repo.query!(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> ALL($1)",
        [@preserved]
      ).rows
      |> List.flatten()

    quoted = Enum.map_join(tables, ", ", &~s("#{&1}"))
    Repo.query!("TRUNCATE TABLE #{quoted} RESTART IDENTITY CASCADE")

    # The materialized search views aren't cleared by TRUNCATE — rebuild them so a
    # reset leaves an empty, consistent index.
    Repo.query!("REFRESH MATERIALIZED VIEW search_documents")
    Repo.query!("REFRESH MATERIALIZED VIEW search_keywords")

    send_resp(conn, :no_content, "")
  end
end
