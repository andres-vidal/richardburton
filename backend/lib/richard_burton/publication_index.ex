defmodule RichardBurton.Publication.Index do
  @moduledoc """
  Full-text search over the publication index.

  A search runs in one of two modes. A plain term is split into words, each
  word is matched on its own (as a prefix, or fuzzily if nothing matches as
  typed), and the words are combined with AND so each one narrows the result.
  A term that quotes a phrase or negates a word is instead passed to Postgres
  verbatim, exactly as written. Either way the match runs against a `tsvector`
  built with accents folded, so a term is folded the same way before it is
  compared.
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

  # The registered total is counted from the same rows the index lists, so the
  # number the reader is shown cannot disagree with the list behind it, and no
  # other representation of a publication leaks into the figure. Cheap now that
  # the flat publication is materialized — a scan of a stored table, not the
  # ten-way join it once stood for.
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
  The indexed words a search term matches.

  The term is split into words and each word is matched on its own, because
  both kinds of match only work word by word: a prefix is the start of a single
  word, and trigram similarity between a word and a whole phrase drops toward
  zero as the phrase grows. Matching a full title as one string would find
  nothing. A word that matches no indexed word is simply left out, so one
  unmatched word does not make the whole search return empty.
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
  The publications a term matches, and the indexed words it matched on.

  The term's words are combined with AND, so each word narrows the result: a
  publication must match every word. That is why searching a full title returns
  just that title, not everything that shares a word with it. For a single word,
  matching any of the indexed words it could be is enough, so a half-typed word
  matches everything it might still become. The words are tried as typed first,
  and only if that matches nothing is the term retried fuzzily, dropping a word
  that matches nothing rather than emptying the result.

  Unbounded, for the caller that needs all of it at once — the CSV export is a
  download of the database, not a page of it. A reader takes it a page at a time
  through `search_order/1` and `details/2` instead.
  """
  def search(term, select: attributes) when is_binary(term) do
    case answering(term) do
      :none -> {:ok, [], []}
      {ask, keywords} -> {:ok, Repo.all(asking(ask, attributes)), keywords}
    end
  end

  @doc """
  The whole ordering a search resolves to — the ids of every publication it
  matches, in the order they are to be read — and the words it matched on, or
  `:none` when nothing in the index answers at all.

  The order is settled here, once. A reader then pages through it by id (see
  `details/2`) and sees a stable list, because the order was fixed the moment
  the search ran: rows cannot shift, skip or repeat as the database changes
  underneath the scroll.
  """
  def search_order(term) when is_binary(term) do
    case answering(term) do
      :none -> :none
      {ask, keywords} -> {order_ids(ask), keywords}
    end
  end

  @doc """
  The ids of the whole database, in the order it is listed — by title, then id.
  The counterpart of `search_order/1` for a reader browsing rather than searching.
  """
  def all_order do
    from(fp in FlatPublication, order_by: [asc: fp.title, asc: fp.id], select: fp.id)
    |> Repo.all()
  end

  @doc """
  The full rows for the given ids, in that order — one stretch of an ordering
  `search_order/1` or `all_order/0` handed back. A `nil` term is a plain
  listing; a term is carried so a row matched only by its references still says
  which.

  An id no longer in the database is simply left out, which is how a deletion
  since the order was fixed shows up: a gap, never a shifted or repeated row.
  """
  def details(ids, term \\ nil)

  def details(ids, nil) when is_list(ids) do
    from(fp in FlatPublication, where: fp.id in ^ids)
    |> Repo.all()
    |> in_order(ids)
  end

  def details(ids, term) when is_list(ids) and is_binary(term) do
    case answering(term) do
      :none ->
        details(ids, nil)

      {ask, _keywords} ->
        from(fp in FlatPublication, where: fp.id in ^ids)
        |> with_source_match(ask)
        |> Repo.all()
        |> in_order(ids)
    end
  end

  @doc "How many publications a page holds."
  def per_page, do: @per_page

  # The database returns rows in whatever order it likes; the caller asked for a
  # particular one, so put them back into it and drop any that have since left.
  defp in_order(rows, ids) do
    by_id = Map.new(rows, &{&1.id, &1})
    ids |> Enum.map(&Map.get(by_id, &1)) |> Enum.reject(&is_nil/1)
  end

  # The publications a search matches, in the order they are to be read: by rank,
  # then title, then id. Rows of equal rank must sort the same way every time, or
  # paging through the results would repeat or skip some.
  defp ranked({:parsed, query}) do
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
  end

  defp ranked({:spelled_out, term}) do
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
  end

  # The ids a search matches, in reading order — the ordering the reader pages
  # through by id.
  defp order_ids(ask), do: ask |> ranked() |> select([p], p.id) |> Repo.all()

  defp with_source_match(query, {:parsed, q}), do: source_match(query, [], :parsed, q)

  defp with_source_match(query, {:spelled_out, term}),
    do: source_match(query, [], :spelled_out, term)

  # What a term is asking for: the query that answers it and the words it
  # resolved to, or `:none` when nothing in the index answers at all.
  #
  # A term that quotes a phrase or negates a word (-word) is stating exactly
  # what it wants, so it is passed to Postgres as written and never widened: no
  # prefix matching, and no fuzzy pass that could add back a word the reader
  # just excluded.
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

  # `:*` makes each word a prefix, so a word still being typed matches every
  # word that starts with it, and a complete word matches itself.
  defp written_query(words) do
    words
    |> Enum.map_join(" & ", &"(#{lexeme(&1)}:*)")
    |> or_the_country_named(Enum.join(words, " "))
  end

  # A record stores a country as its code (US, GB), not its name, so a term
  # that names a country also searches for that code. The whole term is matched
  # against country names, not word by word: "United Kingdom" split into words
  # would search for "kingdom", which no record holds.
  #
  # The code is added only where a country was actually named. A two-letter
  # code is itself a word in these languages, so searching for "NO"
  # unconditionally would match every Portuguese title containing "no".
  defp or_the_country_named(query, term) do
    case Country.codes_named(term) do
      [] -> query
      codes -> "(#{query}) | (#{Enum.map_join(codes, " | ", &"#{lexeme(&1)}:C")})"
    end
  end

  # Nothing matched as typed, so each word is matched against the indexed words
  # it resembles. A word that resembles none is dropped: a typo should cost its
  # own word, not the whole term.
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

  # The full rows a search matches, in reading order — the same ranking as
  # `order_ids/1`, selected whole (or to the asked attributes) for the export
  # that takes the results all at once rather than a page at a time.
  defp asking({:parsed, query} = ask, attributes) do
    ask
    |> ranked()
    |> maybe_select(attributes)
    |> source_match(attributes, :parsed, query)
  end

  defp asking({:spelled_out, term} = ask, attributes) do
    ask
    |> ranked()
    |> maybe_select(attributes)
    |> source_match(attributes, :spelled_out, term)
  end

  # Only the as-written path is counted, to decide whether it answered before
  # falling back to fuzzy; a spelled-out term is handed to Postgres as-is.
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

  # A publication can match on its references, which the index does not display.
  # When it does, build a highlighted snippet of the matching source so the
  # reader can see why the row is here; the matched words are wrapped in [[ ]].
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
