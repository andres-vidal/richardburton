defmodule RichardBurton.Publication.Index do
  @moduledoc """
  Full-text search over the publication index.

  A search runs in one of two modes. A plain term is split on the word `or` into
  alternatives, any of which may match; within an alternative the words are
  matched each on its own (as a prefix, or fuzzily if nothing matches as typed)
  and combined with AND, so each word narrows the result. A term that quotes a
  phrase or negates a word is instead passed to Postgres verbatim, exactly as
  written. Either way the match runs against a `tsvector` built with accents
  folded, so a term is folded the same way before it is compared.
  """

  import Ecto.Query

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication.Index.SearchDocument
  alias RichardBurton.Publication.Index.SearchKeyword
  alias RichardBurton.Repo

  # The response header carrying the index's total publication count.
  @count_header "rb-total-count"

  # How many publications a page holds. Big enough that most readers never ask
  # for a second one, small enough that the first arrives at once.
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

  # The registered total is counted from the same rows the index lists, so it
  # shares the same indexing delay as the search. This is on purpose, so the
  # count matches the number of items the client would get if it fetched the
  # full list at this exact point in time.
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

  The term is split on the word `or` into alternatives, and a publication
  matches if it satisfies any of them. Within an alternative the words are
  combined with AND, so each word narrows: a publication must match every word
  of the alternative. That is why searching a full title returns just that
  title, while "one title or another" returns both. For a single word, matching
  any of the indexed words it could be is enough, so a half-typed word matches
  everything it might still become. The term is tried as typed first, and only
  if that matches nothing is it retried fuzzily, dropping a word that matches
  nothing rather than emptying the result.

  Unbounded, for the caller that needs all of it at once — the CSV export is a
  download of the database, not a page of it. A reader takes it a page at a time
  through `search_order/1` and `details/3` instead.
  """
  def search(term, select: attributes) when is_binary(term) do
    case answering(term) do
      :none -> {:ok, [], []}
      {ask, keywords, _ids} -> {:ok, Repo.all(asking(ask, attributes)), keywords}
    end
  end

  @doc """
  The whole ordering a search resolves to — the ids of every publication it
  matches, in the order they are to be read — and the words it matched on, or
  `:none` when nothing in the index answers at all.

  The order is settled here, once. A reader then pages through it by id (see
  `details/3`) and sees a stable list, because the order was fixed the moment
  the search ran: rows cannot shift, skip or repeat as the database changes
  underneath the scroll.
  """
  def search_order(term) when is_binary(term) do
    case answering(term) do
      :none -> :none
      {_ask, keywords, ids} -> {ids, keywords}
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
  listing; a term and the words it matched on (as `search_order/1` returned
  them) are carried so a row matched only by its references still shows which —
  and shows it without resolving the term over again.

  An id no longer in the database is simply left out, which is how a deletion
  since the order was fixed shows up: a gap, never a shifted or repeated row.
  """
  def details(ids, term \\ nil, keywords \\ [])

  def details(ids, nil, _keywords) when is_list(ids) do
    from(fp in FlatPublication, where: fp.id in ^ids)
    |> Repo.all()
    |> in_order(ids)
  end

  def details(ids, term, keywords) when is_list(ids) and is_binary(term) do
    from(fp in FlatPublication, where: fp.id in ^ids)
    |> source_match([], source_ask(term, keywords))
    |> Repo.all()
    |> in_order(ids)
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
  # paging through the results would repeat or skip some. The two search modes
  # differ only in which tsquery function reads the term, so that difference is
  # all that `matches/1` and `ranking/1` carry.
  defp ranked(ask) do
    from(p in FlatPublication,
      join: d in SearchDocument,
      on: d.id == p.id,
      where: ^matches(ask),
      order_by: ^[desc: ranking(ask), asc: :title, asc: :id]
    )
  end

  defp matches({:parsed, query}),
    do: dynamic(fragment("document @@ to_tsquery('rb_search', ?)", ^query))

  defp matches({:spelled_out, term}),
    do: dynamic(fragment("document @@ websearch_to_tsquery('rb_search', ?)", ^term))

  defp ranking({:parsed, query}),
    do: dynamic(fragment("ts_rank_cd(document, to_tsquery('rb_search', ?), 4)", ^query))

  defp ranking({:spelled_out, term}),
    do: dynamic(fragment("ts_rank_cd(document, websearch_to_tsquery('rb_search', ?), 4)", ^term))

  # The ids a search matches, in reading order — the ordering the reader pages
  # through by id.
  defp order_ids(ask), do: ask |> ranked() |> select([p], p.id) |> Repo.all()

  # What a term is asking for: the query that answers it, the words it resolved
  # to, and the ids it matched — or `:none` when nothing in the index answers.
  #
  # Deciding whether the term answers as written means running it, so what it
  # matched comes back with the answer rather than being asked for again. Only if
  # it matched nothing is the term retried fuzzily.
  #
  # A term that quotes a phrase or negates a word (-word) is stating exactly what
  # it wants, so it is passed to Postgres as written and never widened: no prefix
  # matching, and no fuzzy pass that could add back a word it just excluded.
  defp answering(term) do
    if spelled_out?(term) do
      ask = {:spelled_out, term}
      {ask, [], order_ids(ask)}
    else
      alternatives = or_split(term)
      as_written = {:parsed, written_query(alternatives)}

      case order_ids(as_written) do
        [] -> fuzzily_answering(alternatives)
        ids -> {as_written, prefix_keywords(alternatives), ids}
      end
    end
  end

  defp fuzzily_answering(alternatives) do
    case fuzzily(alternatives) do
      :none -> :none
      {ask, keywords} -> {ask, keywords, order_ids(ask)}
    end
  end

  # Split a term into the alternatives the word `or` separates, each a list of
  # words. "one two or three" becomes [["one", "two"], ["three"]]. A term with
  # no `or` is one alternative, so the AND-narrowing path is unchanged.
  defp or_split(term) do
    term
    |> String.split(~r/\s+or\s+/i, trim: true)
    |> Enum.map(&String.split(&1, ~r/\s+/, trim: true))
    |> Enum.reject(&(&1 == []))
  end

  defp prefix_keywords(alternatives),
    do:
      alternatives
      |> List.flatten()
      |> Enum.flat_map(&search_keywords(&1, :prefix))
      |> Enum.uniq()

  defp spelled_out?(term), do: String.contains?(term, ~s(")) or term =~ ~r/(^|\s)-\S/

  # `:*` makes each word a prefix, so a word still being typed matches every
  # word that starts with it, and a complete word matches itself. A country name
  # is matched the same way as any other word: its names are folded into the
  # document at index time, so "United Kingdom" reaches the record that stores
  # the code "GB" with no special handling here. Alternatives are OR-ed, their
  # words AND-ed.
  defp written_query(alternatives) do
    Enum.map_join(alternatives, " | ", &"(#{and_prefixes(&1)})")
  end

  defp and_prefixes(words), do: Enum.map_join(words, " & ", &"(#{lexeme(&1)}:*)")

  # Nothing matched as typed, so each word is matched against the indexed words
  # it resembles. A word that resembles none is dropped: a typo should cost its
  # own word, not the whole alternative. An alternative left with no words is
  # dropped whole.
  defp fuzzily(alternatives) do
    alternatives
    |> Enum.map(&fuzzy_words/1)
    |> Enum.reject(&(&1 == []))
    |> case do
      [] ->
        :none

      alternatives ->
        query = Enum.map_join(alternatives, " | ", &"(#{and_fuzzy(&1)})")
        {{:parsed, query}, alternatives |> List.flatten() |> Enum.uniq()}
    end
  end

  # One alternative's words resolved to the keywords they resemble, dropping any
  # word that resembles none.
  defp fuzzy_words(words) do
    words
    |> Enum.map(&search_keywords(&1, :fuzzy))
    |> Enum.reject(&(&1 == []))
  end

  defp and_fuzzy(word_groups) do
    Enum.map_join(word_groups, " & ", &"(#{Enum.map_join(&1, " | ", fn w -> lexeme(w) end)})")
  end

  # A word as a tsquery lexeme: quoted, so punctuation in it is read as part of
  # the word rather than as syntax.
  defp lexeme(word), do: "'" <> String.replace(word, "'", "''") <> "'"

  # The full rows a search matches, in reading order — the same ranking as
  # `order_ids/1`, selected whole (or to the asked attributes) for the export
  # that takes the results all at once rather than a page at a time.
  defp asking(ask, attributes) do
    ask
    |> ranked()
    |> maybe_select(attributes)
    |> source_match(attributes, ask)
  end

  # The query to highlight a row's references with — built from the words the
  # search resolved to, which came back with the ids, so a page reads them from
  # the client rather than resolving the term over again. A spelled-out term
  # carries no keywords and is highlighted exactly as it was written.
  defp source_ask(term, keywords) do
    if spelled_out?(term) do
      {:spelled_out, term}
    else
      {:parsed, Enum.map_join(keywords, " | ", &lexeme/1)}
    end
  end

  # A publication can match on its references, which the index does not display.
  # When it does, build a highlighted snippet of the matching source so the
  # reader can see why the row is here; the matched words are wrapped in [[ ]].
  # Only whole-row reads carry it — a column-narrowed export asks for no snippet.
  defp source_match(query, [], {:parsed, term}) do
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

  defp source_match(query, [], {:spelled_out, term}) do
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

  defp source_match(query, _attributes, _ask), do: query
end
