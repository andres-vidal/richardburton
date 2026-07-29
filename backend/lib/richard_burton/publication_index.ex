defmodule RichardBurton.Publication.Index do
  @moduledoc """
  Interface with the searchable publication index
  """

  import Ecto.Query

  alias RichardBurton.Country
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

  # The index holds words with their accents folded away, so a term is folded
  # the same way before it is compared to them.
  def search_keywords(term, :prefix) do
    from(w in SearchKeyword, where: ilike(w.word, fragment("unaccent(?)", ^"#{term}%")))
    |> Repo.all()
    |> Enum.map(&Map.get(&1, :word))
  end

  def search_keywords(term, :fuzzy) do
    from(
      w in SearchKeyword,
      where: fragment("similarity((?), unaccent(?)) > 0.3", w.word, ^term)
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
    if spelled_out?(term) do
      found(exactly(term, attributes))
    else
      words = String.split(term, ~r/\s+/, trim: true)

      case as_written(words, attributes) do
        {[], _keywords} -> found(fuzzily(words, attributes))
        results -> found(results)
      end
    end
  end

  defp found({results, keywords}), do: {:ok, results, keywords}

  # A term that quotes a phrase or excludes a word is saying precisely what it
  # wants, so it is handed to Postgres as written and never widened: no
  # prefixes, and nothing fuzzy to put back what the reader just excluded.
  defp spelled_out?(term), do: String.contains?(term, ~s(")) or term =~ ~r/(^|\s)-\S/

  defp exactly(term, attributes) do
    query =
      from(p in FlatPublication,
        join: d in SearchDocument,
        on: d.id == p.id,
        where: fragment("document @@ websearch_to_tsquery('rb_search', ?)", ^term),
        order_by: [
          desc: fragment("ts_rank_cd(document, websearch_to_tsquery('rb_search', ?), 4)", ^term),
          asc: p.title,
          asc: p.id
        ]
      )
      |> maybe_select(attributes)
      |> source_match(attributes, :spelled_out, term)

    {Repo.all(query), []}
  end

  # Each word stands for what it starts, so a word still being typed matches
  # what it will be, and a finished one matches itself. A word that names a
  # country stands for its code too, which is what the record holds.
  defp as_written(words, attributes) do
    query =
      words
      |> Enum.map_join(" & ", &"(#{alternatives(&1)})")
      |> or_the_country_named(Enum.join(words, " "))

    case Repo.all(matching(query, attributes)) do
      [] -> {[], []}
      results -> {results, Enum.flat_map(words, &search_keywords(&1, :prefix)) |> Enum.uniq()}
    end
  end

  defp alternatives(word) do
    ["#{lexeme(word)}:*" | Enum.map(Country.codes_named(word), &lexeme/1)]
    |> Enum.join(" | ")
  end

  # Most country names are one word, but the ones that are not would otherwise
  # ask for words no record holds: nothing is published in a "kingdom". A term
  # naming a country asks for its code as a whole, whatever it is made of.
  defp or_the_country_named(query, term) do
    case Country.codes_named(term) do
      [] -> query
      codes -> "(#{query}) | (#{Enum.map_join(codes, " | ", &lexeme/1)})"
    end
  end

  # Nothing was written the way the index holds it, so each word asks for the
  # keywords it resembles. One that resembles none is dropped: a typo should
  # cost its own word rather than the whole term.
  defp fuzzily(words, attributes) do
    words
    |> Enum.map(&search_keywords(&1, :fuzzy))
    |> Enum.reject(&(&1 == []))
    |> case do
      [] ->
        {[], []}

      groups ->
        query =
          Enum.map_join(groups, " & ", &"(#{Enum.map_join(&1, " | ", fn w -> lexeme(w) end)})")

        {Repo.all(matching(query, attributes)), Enum.uniq(List.flatten(groups))}
    end
  end

  # A word as a tsquery lexeme: quoted, so punctuation in it is read as part of
  # the word rather than as syntax.
  defp lexeme(word), do: "'" <> String.replace(word, "'", "''") <> "'"

  # Rank first, then the title, then the id: equally relevant rows have to come
  # back in the same order every time, or a page of them is not a page.
  defp matching(query, attributes) do
    from(p in FlatPublication,
      join: d in SearchDocument,
      on: d.id == p.id,
      where: fragment("document @@ to_tsquery('rb_search', ?)", ^query),
      order_by: [
        desc: fragment("ts_rank_cd(document, to_tsquery('rb_search', ?), 4)", ^query),
        asc: p.title,
        asc: p.id
      ]
    )
    |> maybe_select(attributes)
    |> source_match(attributes, :parsed, query)
  end

  # Why a row is here, when the answer is nowhere on it: a publication can match
  # on its sources, which the index does not show. Only then is there a snippet,
  # and the words that answered are wrapped for the reader to pick out.
  defp source_match(query, [], :parsed, term) do
    select_merge(query, [p], %{
      source_match:
        fragment(
          "CASE WHEN to_tsvector('rb_search', array_to_string(?, ' ')) @@ to_tsquery('rb_search', ?) THEN ts_headline('rb_search', array_to_string(?, ' '), to_tsquery('rb_search', ?), 'StartSel=[[,StopSel=]],MaxFragments=1,MaxWords=16,MinWords=6') ELSE NULL END",
          p.references,
          ^term,
          p.references,
          ^term
        )
    })
  end

  defp source_match(query, [], :spelled_out, term) do
    select_merge(query, [p], %{
      source_match:
        fragment(
          "CASE WHEN to_tsvector('rb_search', array_to_string(?, ' ')) @@ websearch_to_tsquery('rb_search', ?) THEN ts_headline('rb_search', array_to_string(?, ' '), websearch_to_tsquery('rb_search', ?), 'StartSel=[[,StopSel=]],MaxFragments=1,MaxWords=16,MinWords=6') ELSE NULL END",
          p.references,
          ^term,
          p.references,
          ^term
        )
    })
  end

  defp source_match(query, _attributes, _kind, _term), do: query
end
