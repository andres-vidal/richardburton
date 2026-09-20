defmodule RichardBurton.Repo.Migrations.SearchCountriesByCodeAndEveryName do
  use Ecto.Migration

  @moduledoc """
  Recompute the names each country is searchable by.

  A country now answers to both its ISO codes, to the name it is shown under in
  each language the platform speaks, and to the other names readers type for it.
  Before this, it answered to whatever the ISO library carried, which held no
  Portuguese at all: a reader could see "Países Baixos" on the page and find
  nothing by searching it.

  The column and the views are unchanged. `names` is derived from the code, so
  this only asks for it to be derived again, and rebuilds the documents stacked
  on it.
  """

  alias RichardBurton.Country
  alias RichardBurton.Repo

  import Ecto.Query

  def up do
    for {id, code} <- Repo.all(from(c in "countries", select: {c.id, c.code})) do
      Repo.update_all(
        from(c in "countries", where: c.id == ^id),
        set: [names: Country.names_for(code)]
      )
    end

    rebuild_documents()
  end

  # `names` holds what the code derives today, and what it derived before is not
  # recoverable from here. Going back leaves the names as they are and rebuilds
  # the documents, so the index still matches what is stored.
  def down, do: rebuild_documents()

  # search_keywords reads search_documents, so the order matters. Plain rather
  # than concurrent: a migration runs in a transaction, where CONCURRENTLY is
  # not allowed.
  defp rebuild_documents do
    execute("REFRESH MATERIALIZED VIEW search_documents")
    execute("REFRESH MATERIALIZED VIEW search_keywords")
  end
end
