defmodule RichardBurton.Publication.Index do
  @moduledoc """
  Full-text search over the publication index.

  A term parses into alternatives separated by `:or` (or `:ou`), any of which
  may match. An alternative holds free words — matched individually by prefix,
  or fuzzily if nothing matches as typed, and AND-ed together — plus operators
  scoped to a single field:

      title:casmurro            title only
      autor:machado             author, in Portuguese
      year:1950-1960            year range
      -country:US               negated
      title:"dom casmurro"      phrase, in that order

  An alternative matches when its words and its filters both match. A term that
  quotes or negates but contains no operator is passed to `websearch_to_tsquery`
  unchanged.

  Both paths match against a `tsvector` built with accents folded, so the term
  is folded the same way first. See `RichardBurton.Publication.Index.Term` for
  the operators and the names they accept.
  """

  import Ecto.Query

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication.Index.SearchDocument
  alias RichardBurton.Publication.Index.SearchKeyword
  alias RichardBurton.Publication.Index.Term
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

  The term is split on `:or` (or `:ou`) into alternatives, and a publication
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

  # The WHERE clause for a search: a term passed through verbatim, or the
  # alternatives parsed out of it.
  defp matches({:spelled_out, term}),
    do: dynamic(fragment("document @@ websearch_to_tsquery('rb_search', ?)", ^term))

  # Alternatives are OR-ed; within one, words and filters are AND-ed.
  defp matches({:alternatives, alternatives}) do
    alternatives
    |> Enum.map(&alternative_predicate/1)
    |> Enum.reduce(fn predicate, acc -> dynamic(^acc or ^predicate) end)
  end

  # One alternative: its free words and each of its filters, AND-ed.
  defp alternative_predicate(%{query: query, filters: filters, mode: mode}) do
    [words_predicate(query) | Enum.map(filters, &filter_predicate(&1, mode))]
    |> Enum.reject(&is_nil/1)
    |> case do
      # No usable predicate: match nothing rather than everything.
      [] -> dynamic(false)
      predicates -> Enum.reduce(predicates, fn predicate, acc -> dynamic(^acc and ^predicate) end)
    end
  end

  # The free words matched against the whole search document. An alternative of
  # only operators has none, and contributes no predicate.
  defp words_predicate(nil), do: nil

  defp words_predicate(query),
    do: dynamic(fragment("document @@ to_tsquery('rb_search', ?)", ^query))

  # An operator matches against one column rather than the search document. A
  # quoted value matches as a phrase; anything else by prefix, like free text.
  # An unusable value — an unparseable span, a word absent from the index —
  # matches nothing rather than dropping the operator, which would widen a term
  # the user narrowed.
  defp filter_predicate(%{field: :year, value: value, negated: negated}, _mode) do
    case Term.span(value) do
      :none -> negate(dynamic(false), negated)
      {from, to} -> negate(year_predicate(from, to), negated)
    end
  end

  defp filter_predicate(%{field: field, value: value, exact: exact, negated: negated}, mode) do
    case value_query(value, exact, mode) do
      :none -> negate(dynamic(false), negated)
      query -> negate(text_predicate(field, query), negated)
    end
  end

  # A filter written with a leading minus excludes what it would otherwise match.
  defp negate(predicate, false), do: predicate
  defp negate(predicate, true), do: dynamic(not (^predicate))

  # A year range compared as integers rather than text, with a nil bound leaving
  # that end open.
  defp year_predicate(nil, to), do: dynamic([p], p.year <= ^to)
  defp year_predicate(from, nil), do: dynamic([p], p.year >= ^from)
  defp year_predicate(from, to), do: dynamic([p], p.year >= ^from and p.year <= ^to)

  # `references` is an array, matched as its joined text, the same form
  # `search_documents` indexes it in.
  defp text_predicate(:references, query) do
    dynamic(
      [p],
      fragment("to_tsvector('rb_search', array_to_string(?, ' ')) @@ ?", p.references, ^query)
    )
  end

  defp text_predicate(field, query) do
    dynamic(
      [p],
      fragment("to_tsvector('rb_search', coalesce(?::text, '')) @@ ?", field(p, ^field), ^query)
    )
  end

  # A quoted value matches as a phrase in either mode.
  defp value_query(value, true, _mode),
    do: dynamic(fragment("phraseto_tsquery('rb_search', ?)", ^value))

  defp value_query(value, false, :prefix) do
    query = value |> String.split(~r/\s+/, trim: true) |> and_prefixes()
    dynamic(fragment("to_tsquery('rb_search', ?)", ^query))
  end

  # In fuzzy mode each word of the value expands to the indexed words it
  # resembles, as a free word does.
  defp value_query(value, false, :fuzzy) do
    value
    |> String.split(~r/\s+/, trim: true)
    |> Enum.map(&search_keywords(&1, :fuzzy))
    |> Enum.split_with(&(&1 == []))
    |> fuzzy_value_query()
  end

  # Builds a query only when every word resolved to at least one keyword. A word
  # that resolved to none is absent from the index, so the value cannot match.
  defp fuzzy_value_query({[], [_ | _] = groups}),
    do: dynamic(fragment("to_tsquery('rb_search', ?)", ^and_fuzzy(groups)))

  defp fuzzy_value_query(_unresolved), do: :none

  # How results are ordered: how well each row matches what was searched for.
  defp ranking({:spelled_out, term}),
    do: dynamic(fragment("ts_rank_cd(document, websearch_to_tsquery('rb_search', ?), 4)", ^term))

  # Ranks on the free words of every alternative; one made only of operators
  # contributes nothing to rank by.
  defp ranking({:alternatives, alternatives}) do
    alternatives
    |> Enum.map(& &1.query)
    |> Enum.reject(&is_nil/1)
    |> case do
      [] -> dynamic(0.0)
      queries -> ranking_by(Enum.map_join(queries, " | ", &"(#{&1})"))
    end
  end

  # One tsquery's contribution to the rank.
  defp ranking_by(query),
    do: dynamic(fragment("ts_rank_cd(document, to_tsquery('rb_search', ?), 4)", ^query))

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
    alternatives = Term.parse(term)

    cond do
      alternatives == [] ->
        :none

      # Quotes or exclusions with no operator: passed through unchanged.
      plain?(alternatives) and spelled_out?(term) ->
        ask = {:spelled_out, term}
        {ask, [], order_ids(ask)}

      true ->
        as_written = asked(alternatives, :prefix)

        case order_ids(as_written) do
          [] -> fuzzily_answering(alternatives)
          ids -> {as_written, keywords(alternatives, :prefix), ids}
        end
    end
  end

  # Whether a term carries no operators, and so can take the verbatim path.
  defp plain?(alternatives), do: Enum.all?(alternatives, &(&1.filters == []))

  # The fuzzy pass, run only when nothing matched as typed.
  defp fuzzily_answering(alternatives) do
    case fuzzily(alternatives) do
      :none -> :none
      {ask, keywords} -> {ask, keywords, order_ids(ask)}
    end
  end

  # Per alternative: the tsquery for its free words, and the filters that
  # narrow it.
  defp asked(alternatives, mode) do
    {:alternatives,
     Enum.map(alternatives, fn alternative ->
       %{
         query: words_query(alternative.words, mode),
         filters: alternative.filters,
         mode: mode
       }
     end)}
  end

  # One alternative's free words as a tsquery: nil when it has none, or when no
  # word resolved to anything in the fuzzy pass.
  defp words_query([], _mode), do: nil
  defp words_query(words, :prefix), do: and_prefixes(words)

  defp words_query(words, :fuzzy) do
    case fuzzy_words(words) do
      [] -> nil
      groups -> and_fuzzy(groups)
    end
  end

  # Whether a term quotes a phrase or negates a word, which Postgres understands
  # itself through `websearch_to_tsquery`.
  defp spelled_out?(term), do: String.contains?(term, ~s(")) or term =~ ~r/(^|\s)-\S/

  # Every word required, each matched from its start.
  defp and_prefixes(words), do: Enum.map_join(words, " & ", &"(#{lexeme(&1)}:*)")

  # Nothing matched as typed, so each word is matched against the indexed words
  # it resembles. A word resembling none is dropped rather than failing the
  # alternative; an alternative left with no words is dropped entirely.
  defp fuzzily(alternatives) do
    {:alternatives, asked} = ask = asked(alternatives, :fuzzy)

    # No word resolved and no filter applies: nothing to search for.
    if Enum.all?(asked, &(&1.query == nil and &1.filters == [])) do
      :none
    else
      {ask, keywords(alternatives, :fuzzy)}
    end
  end

  # The indexed keywords the free words resolved to, returned so the UI can show
  # what the search matched on.
  defp keywords(alternatives, mode) do
    alternatives
    |> Enum.flat_map(& &1.words)
    |> Enum.flat_map(&search_keywords(&1, mode))
    |> Enum.uniq()
  end

  # One alternative's words resolved to the keywords they resemble, dropping any
  # that resolved to none.
  defp fuzzy_words(words) do
    words
    |> Enum.map(&search_keywords(&1, :fuzzy))
    |> Enum.reject(&(&1 == []))
  end

  # Every word required, each satisfied by any of the indexed words it resembles.
  defp and_fuzzy(word_groups) do
    Enum.map_join(word_groups, " & ", &"(#{Enum.map_join(&1, " | ", fn w -> lexeme(w) end)})")
  end

  # A word as a tsquery lexeme, quoted so punctuation in it is read as part of
  # the word rather than as tsquery syntax.
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
