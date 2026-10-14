defmodule RichardBurton.Publication.Index.SearchDocument do
  @moduledoc """
  A publication's search document: the `tsvector` that a search's free words
  are matched against, read from the `search_documents` materialized view.
  Its `id` is the id of the publication in `flat_publications`.
  """
  use Ecto.Schema

  schema "search_documents" do
    field(:document, {:array, :binary})
  end
end
