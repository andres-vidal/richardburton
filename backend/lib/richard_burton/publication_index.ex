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

  # How many publications a page holds. Big enough that most readers never ask
  # for a second one, small enough that the first arrives at once. Smaller under
  # test, so a page boundary is something a fixture can reach.
  @per_page Application.compile_env(:richard_burton, :publications_per_page, 50)

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
  Every publication a term asks for, and the indexed words it resolved to.

  Every word narrows: a publication has to answer all of them, so a title asked
  for in full returns the publication it names rather than everything sharing a
  word with it. A word is answered by any of the keywords it names, which is
  what lets a half-typed one stand for what it starts.

  Words are read as written first. Only when that finds nothing does the whole
  term go fuzzy, where a word naming nothing is dropped rather than emptying
  the search: a typo should cost its own word, not the others.

  Unbounded, for the caller that needs all of it at once — the CSV export is a
  download of the database, not a page of it. Reading for a page goes through
  `page/2`.
  """
  def search(term, select: attributes) when is_binary(term) do
    case answering(term) do
      :none -> {:ok, [], []}
      {ask, keywords} -> {:ok, Repo.all(asking(ask, attributes)), keywords}
    end
  end

  @doc """
  One page of what a term asks for, the words it resolved to, and how many it
  asks for in all.

  Whether a term is answered at all is the same question as how many answer it,
  so the ladder is walked once, by counting: the page is drawn from wherever it
  stopped.
  """
  def search_page(term, page) when is_binary(term) do
    case answering(term) do
      :none ->
        {:ok, [], [], 0}

      {ask, keywords} ->
        {:ok, Repo.all(asking(ask, []) |> paged(page)), keywords, count_asking(ask)}
    end
  end

  @doc """
  One page of the whole database, ordered as it is listed, and how many
  publications there are to page through.
  """
  def all_page(page) do
    query = from(fp in FlatPublication, order_by: [asc: fp.title, asc: fp.id])

    {:ok, Repo.all(paged(query, page)), count()}
  end

  @doc "How many publications a page holds."
  def per_page, do: @per_page

  # Page one is the first page, and so is anything before it.
  defp paged(query, page) do
    from(q in query, limit: @per_page, offset: ^(max(page - 1, 0) * @per_page))
  end

  # What a term is asking for: the query that answers it and the words it
  # resolved to, or `:none` when nothing in the index answers at all.
  #
  # A term that quotes a phrase or excludes a word is saying precisely what it
  # wants, so it is handed to Postgres as written and never widened: no
  # prefixes, and nothing fuzzy to put back what the reader just excluded.
  defp answering(term) do
    if spelled_out?(term) do
      {{:spelled_out, term}, []}
    else
      words = String.split(term, ~r/\s+/, trim: true)
      as_written = {:parsed, written_query(words)}

      if count_asking(as_written) > 0 do
        {as_written, words |> Enum.flat_map(&search_keywords(&1, :prefix)) |> Enum.uniq()}
      else
        fuzzily(words)
      end
    end
  end

  defp spelled_out?(term), do: String.contains?(term, ~s(")) or term =~ ~r/(^|\s)-\S/

  # Each word stands for what it starts, so a word still being typed matches
  # what it will be, and a finished one matches itself.
  defp written_query(words) do
    words
    |> Enum.map_join(" & ", &"(#{lexeme(&1)}:*)")
    |> or_the_country_named(Enum.join(words, " "))
  end

  # A term naming a country asks for its code, which is what the record holds.
  # The term as a whole, because a name of several words would otherwise ask for
  # words no record has: nothing is published in a "kingdom".
  #
  # The code is asked for where a country is written and nowhere else: two
  # letters are a word of their own in the languages here, and "NO" would
  # otherwise answer for every Portuguese title carrying "no".
  defp or_the_country_named(query, term) do
    case Country.codes_named(term) do
      [] -> query
      codes -> "(#{query}) | (#{Enum.map_join(codes, " | ", &"#{lexeme(&1)}:C")})"
    end
  end

  # Nothing was written the way the index holds it, so each word asks for the
  # keywords it resembles. One that resembles none is dropped: a typo should
  # cost its own word rather than the whole term.
  defp fuzzily(words) do
    words
    |> Enum.map(&search_keywords(&1, :fuzzy))
    |> Enum.reject(&(&1 == []))
    |> case do
      [] ->
        :none

      groups ->
        query =
          Enum.map_join(groups, " & ", &"(#{Enum.map_join(&1, " | ", fn w -> lexeme(w) end)})")

        {{:parsed, query}, groups |> List.flatten() |> Enum.uniq()}
    end
  end

  # A word as a tsquery lexeme: quoted, so punctuation in it is read as part of
  # the word rather than as syntax.
  defp lexeme(word), do: "'" <> String.replace(word, "'", "''") <> "'"

  # Rank first, then the title, then the id: equally relevant rows have to come
  # back in the same order every time, or a page of them is not a page.
  defp asking({:parsed, query}, attributes) do
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

  defp asking({:spelled_out, term}, attributes) do
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
  end

  defp count_asking({:parsed, query}) do
    Repo.one(
      from(p in FlatPublication,
        join: d in SearchDocument,
        on: d.id == p.id,
        where: fragment("document @@ to_tsquery('rb_search', ?)", ^query),
        select: count(p.id)
      )
    )
  end

  defp count_asking({:spelled_out, term}) do
    Repo.one(
      from(p in FlatPublication,
        join: d in SearchDocument,
        on: d.id == p.id,
        where: fragment("document @@ websearch_to_tsquery('rb_search', ?)", ^term),
        select: count(p.id)
      )
    )
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
