defmodule RichardBurton.Publication.Index do
  @moduledoc """
  Full-text search over the publication index.

  A term is read as the alternatives `:or` (or `:ou`) separates, any of which
  may match. An alternative is free words — matched each on its own, as a
  prefix or fuzzily if nothing matches as typed, and combined with AND so each
  one narrows — together with the operators that name a single field:

      title:casmurro            the title alone
      autor:machado             the writer, in Portuguese
      year:1950-1960            a span of years
      -country:US               everything but
      title:"dom casmurro"      the phrase, in that order

  An alternative is satisfied by its words and its operators together. A term
  with no operator that quotes a phrase or negates a word is passed to Postgres
  verbatim instead, exactly as written.

  Either way the match runs against a `tsvector` built with accents folded, so a
  term is folded the same way before it is compared. See
  `RichardBurton.Publication.Index.Term` for the operators and the words that
  name them.
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

  defp matches({:spelled_out, term}),
    do: dynamic(fragment("document @@ websearch_to_tsquery('rb_search', ?)", ^term))

  # Any alternative will do, and each is its words and its operators together.
  defp matches({:alternatives, alternatives}) do
    alternatives
    |> Enum.map(&alternative_predicate/1)
    |> Enum.reduce(fn predicate, acc -> dynamic(^acc or ^predicate) end)
  end

  defp alternative_predicate(%{query: query, filters: filters}) do
    [words_predicate(query) | Enum.map(filters, &filter_predicate/1)]
    |> Enum.reject(&is_nil/1)
    |> case do
      # Only operators nothing could be made of: the alternative asks nothing,
      # rather than silently asking for everything.
      [] -> dynamic(false)
      predicates -> Enum.reduce(predicates, fn predicate, acc -> dynamic(^acc and ^predicate) end)
    end
  end

  defp words_predicate(nil), do: nil

  defp words_predicate(query),
    do: dynamic(fragment("document @@ to_tsquery('rb_search', ?)", ^query))

  # An operator asks of one field rather than of the whole document, so it is
  # matched against that field's own text. A quoted value is a phrase, taken in
  # order; anything else matches from the start of a word, as free text does.
  defp filter_predicate(%{field: :year, value: value, negated: negated}) do
    case Term.span(value) do
      :none -> nil
      {from, to} -> negate(year_predicate(from, to), negated)
    end
  end

  defp filter_predicate(%{field: field, value: value, exact: exact, negated: negated}) do
    negate(text_predicate(field, value, exact), negated)
  end

  defp negate(predicate, false), do: predicate
  defp negate(predicate, true), do: dynamic(not (^predicate))

  defp year_predicate(nil, to), do: dynamic([p], p.year <= ^to)
  defp year_predicate(from, nil), do: dynamic([p], p.year >= ^from)
  defp year_predicate(from, to), do: dynamic([p], p.year >= ^from and p.year <= ^to)

  # References are a list, so they are matched as the text of the whole list —
  # the same thing the search document folds them in as.
  defp text_predicate(:references, value, exact) do
    dynamic(
      [p],
      fragment(
        "to_tsvector('rb_search', array_to_string(?, ' ')) @@ ?",
        p.references,
        ^value_query(value, exact)
      )
    )
  end

  defp text_predicate(field, value, exact) do
    dynamic(
      [p],
      fragment(
        "to_tsvector('rb_search', coalesce(?::text, '')) @@ ?",
        field(p, ^field),
        ^value_query(value, exact)
      )
    )
  end

  defp value_query(value, true),
    do: dynamic(fragment("phraseto_tsquery('rb_search', ?)", ^value))

  defp value_query(value, false) do
    query = value |> String.split(~r/\s+/, trim: true) |> and_prefixes()
    dynamic(fragment("to_tsquery('rb_search', ?)", ^query))
  end

  defp ranking({:spelled_out, term}),
    do: dynamic(fragment("ts_rank_cd(document, websearch_to_tsquery('rb_search', ?), 4)", ^term))

  # Rank on the words asked for, whichever alternative they came from; an
  # alternative made only of operators has nothing to rank by and adds nothing.
  defp ranking({:alternatives, alternatives}) do
    alternatives
    |> Enum.map(& &1.query)
    |> Enum.reject(&is_nil/1)
    |> case do
      [] -> dynamic(0.0)
      queries -> ranking_by(Enum.map_join(queries, " | ", &"(#{&1})"))
    end
  end

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

      # A term that only quotes or excludes, with no operator in it, is still
      # handed to Postgres as written — the path that has always served it.
      plain?(alternatives) and spelled_out?(term) ->
        ask = {:spelled_out, term}
        {ask, [], order_ids(ask)}

      true ->
        as_written = asked(alternatives, :prefix)

        case order_ids(as_written) do
          [] -> fuzzily_answering(alternatives)
          ids -> {as_written, prefix_keywords(alternatives), ids}
        end
    end
  end

  defp plain?(alternatives), do: Enum.all?(alternatives, &(&1.filters == []))

  defp fuzzily_answering(alternatives) do
    case fuzzily(alternatives) do
      :none -> :none
      {ask, keywords} -> {ask, keywords, order_ids(ask)}
    end
  end

  # What the search asks of the database: for each alternative, the words to
  # look for anywhere in the record and the operators that narrow it. An
  # alternative is satisfied by both together, and any alternative will do.
  defp asked(alternatives, mode) do
    {:alternatives,
     Enum.map(alternatives, fn alternative ->
       %{query: words_query(alternative.words, mode), filters: alternative.filters}
     end)}
  end

  defp words_query([], _mode), do: nil
  defp words_query(words, :prefix), do: and_prefixes(words)

  defp words_query(words, :fuzzy) do
    case fuzzy_words(words) do
      [] -> nil
      groups -> and_fuzzy(groups)
    end
  end

  defp prefix_keywords(alternatives),
    do:
      alternatives
      |> Enum.flat_map(& &1.words)
      |> Enum.flat_map(&search_keywords(&1, :prefix))
      |> Enum.uniq()

  defp spelled_out?(term), do: String.contains?(term, ~s(")) or term =~ ~r/(^|\s)-\S/

  defp and_prefixes(words), do: Enum.map_join(words, " & ", &"(#{lexeme(&1)}:*)")

  # Nothing matched as typed, so each word is matched against the indexed words
  # it resembles. A word that resembles none is dropped: a typo should cost its
  # own word, not the whole alternative. An alternative left with no words is
  # dropped whole.
  defp fuzzily(alternatives) do
    {:alternatives, asked} = ask = asked(alternatives, :fuzzy)

    # Nothing resembled anything and no operator narrowed anything: the term
    # names nothing this database holds.
    if Enum.all?(asked, &(&1.query == nil and &1.filters == [])) do
      :none
    else
      {ask, fuzzy_keywords(alternatives)}
    end
  end

  defp fuzzy_keywords(alternatives) do
    alternatives
    |> Enum.flat_map(& &1.words)
    |> Enum.flat_map(&search_keywords(&1, :fuzzy))
    |> Enum.uniq()
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
