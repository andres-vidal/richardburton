defmodule RichardBurton.Publication.Index do
  @moduledoc """
  Interface with the searchable publication index
  """

  import Ecto.Query

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication.Index.SearchDocument
  alias RichardBurton.Publication.Index.SearchKeyword
  alias RichardBurton.Repo

  # The response header carrying the index's total publication count.
  @count_header "rb-total-count"

  @doc "Name of the response header carrying the index's total count."
  @spec count_header() :: String.t()
  def count_header, do: @count_header

  def all do
    all(select: [])
  end

  def all(select: attributes) when is_list(attributes) do
    results =
      from(fp in FlatPublication)
      |> maybe_select(attributes)
      |> Repo.all()

    {:ok, results}
  end

  def count() do
    Repo.aggregate(FlatPublication, :count, :id)
  end

  @doc """
  Publications with no provenance, ordered by id — the stable queue the references
  backfill steps through.
  """
  def without_references do
    results =
      from(fp in FlatPublication,
        where: fragment("cardinality(?) = 0", fp.references),
        order_by: [asc: fp.id]
      )
      |> Repo.all()

    {:ok, results}
  end

  defp maybe_select(query, []) do
    query
  end

  defp maybe_select(query, attributes) do
    select(query, [fp], map(fp, ^attributes))
  end

  def search_keywords(term, :prefix) do
    from(w in SearchKeyword, where: ilike(w.word, ^"#{term}%"))
    |> Repo.all()
    |> Enum.map(&Map.get(&1, :word))
  end

  def search_keywords(term, :fuzzy) do
    from(
      w in SearchKeyword,
      where: fragment("similarity((?), (?)) > 0.3", w.word, ^term)
    )
    |> Repo.all()
    |> Enum.map(&Map.get(&1, :word))
  end

  def search_keywords(term) when is_binary(term) do
    case search_keywords(term, :prefix) do
      [] -> search_keywords(term, :fuzzy)
      keywords when is_list(keywords) -> keywords
    end
  end

  def search(term) do
    search(term, select: [])
  end

  def search(term, select: attributes) when is_binary(term) do
    case search_keywords(term) do
      [] ->
        {:ok, [], []}

      keywords when is_list(keywords) ->
        joint_keywords = Enum.join(keywords, " OR ")

        query =
          from(p in FlatPublication,
            join: d in SearchDocument,
            on: d.id == p.id,
            where: fragment("document @@ websearch_to_tsquery('simple', ?)", ^joint_keywords),
            order_by:
              {:desc,
               fragment(
                 "ts_rank_cd(document, websearch_to_tsquery('simple', ?), 4)",
                 ^joint_keywords
               )}
          )
          |> maybe_select(attributes)

        results = Repo.all(query)

        {:ok, results, keywords}
    end
  end
end
