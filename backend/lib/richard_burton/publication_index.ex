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

  @doc """
  The indexed words a search term is asking about.

  A term is matched a word at a time. Both matches this rests on compare a
  single word: a prefix is one, and trigram similarity to a whole phrase falls
  away as the phrase grows, so a title asked for in full would resolve to
  nothing at all. A word that names no keyword contributes none rather than
  emptying the search.
  """
  def search_keywords(term) when is_binary(term) do
    term
    |> String.split(~r/\s+/, trim: true)
    |> Enum.flat_map(&keywords_naming/1)
    |> Enum.uniq()
  end

  defp keywords_naming(word) do
    case search_keywords(word, :prefix) do
      [] -> search_keywords(word, :fuzzy)
      keywords when is_list(keywords) -> keywords
    end
  end

  def search(term) do
    search(term, select: [])
  end

  @doc """
  The publications a term is asking for, and the indexed words it resolved to.

  Every word narrows: a publication has to answer all of them, so a title asked
  for in full returns the publication it names rather than everything sharing a
  word with it. A word is answered by any of the keywords it names, which is
  what lets a half-typed one stand for what it starts.

  Words are read as written first. Only when that finds nothing does the whole
  term go fuzzy, where a word naming nothing is dropped rather than emptying
  the search: a typo should cost its own word, not the others.
  """
  def search(term, select: attributes) when is_binary(term) do
    words = String.split(term, ~r/\s+/, trim: true)

    case narrow(words, :prefix, attributes) do
      {[], _keywords} -> found(narrow(words, :fuzzy, attributes))
      results -> found(results)
    end
  end

  defp found({results, keywords}), do: {:ok, results, keywords}

  defp narrow(words, strategy, attributes) do
    words
    |> Enum.map(&search_keywords(&1, strategy))
    |> answers(strategy)
    |> case do
      [] -> {[], []}
      groups -> {Repo.all(matching(groups, attributes)), Enum.uniq(List.flatten(groups))}
    end
  end

  # Read as written, a word that names nothing means the term is not in the
  # index as typed, and the whole term is better off going fuzzy.
  defp answers(groups, :prefix), do: if(Enum.any?(groups, &(&1 == [])), do: [], else: groups)
  defp answers(groups, :fuzzy), do: Enum.reject(groups, &(&1 == []))

  defp matching(groups, attributes) do
    ranked = groups |> List.flatten() |> Enum.uniq() |> Enum.join(" OR ")

    groups
    |> Enum.reduce(
      from(p in FlatPublication,
        join: d in SearchDocument,
        on: d.id == p.id,
        order_by:
          {:desc, fragment("ts_rank_cd(document, websearch_to_tsquery('simple', ?), 4)", ^ranked)}
      ),
      fn group, query ->
        joint = Enum.join(group, " OR ")
        where(query, fragment("document @@ websearch_to_tsquery('simple', ?)", ^joint))
      end
    )
    |> maybe_select(attributes)
  end
end
