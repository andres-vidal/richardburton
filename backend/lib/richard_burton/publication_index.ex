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

  An alternative matches when its words and its filters both match.

  Two more words carry specific meanings here, both of which appear as tags in
  the code:

    * **spelled out** — a term that quotes or negates but contains no operator.
      It is passed to `websearch_to_tsquery` unchanged rather than parsed, since
      Postgres already reads that syntax. Tagged `{:spelled_out, term}`.
    * **ask** — the tagged tuple a parsed term becomes, either
      `{:spelled_out, term}` or `{:alternatives, alternatives}`. It is what
      `matches/1` and `ranking/1` are built from, and the only thing the two
      paths differ by.
    * **mode** — how a word is matched: `:prefix` from the start of a word, or
      `:fuzzy` against the indexed words it resembles. A search runs in `:prefix`
      first and falls back to `:fuzzy` only when that returns nothing. The two
      modes differ only in which tsquery function reads the term.

  Both paths match against a `tsvector` built with accents folded, so the term
  is folded the same way first. See `RichardBurton.Publication.Index.Term` for
  the term vocabulary and the names each operator accepts.
  """

  import Ecto.Query

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication.Index.SearchDocument
  alias RichardBurton.Publication.Index.Highlight
  alias RichardBurton.Publication.Index.Keywords
  alias RichardBurton.Publication.Index.Query
  alias RichardBurton.Publication.Index.Term
  alias RichardBurton.Repo

  # The response header carrying the index's total publication count.
  @count_header "rb-total-count"

  # How many publications a page holds: large enough that a first page usually
  # suffices, small enough that it arrives in one response.
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
    |> Highlight.select([], Highlight.asked(term, keywords))
    |> Repo.all()
    |> in_order(ids)
  end

  @doc "How many publications a page holds."
  def per_page, do: @per_page

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
      plain?(alternatives) and Query.spelled_out?(term) ->
        ask = {:spelled_out, term}
        {ask, [], order_ids(ask)}

      true ->
        as_written = Query.asked(alternatives, :prefix)

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

  # Nothing matched as typed, so each word is matched against the indexed words
  # it resembles. A word resembling none is dropped rather than failing the
  # alternative; an alternative left with no words is dropped entirely.
  defp fuzzily(alternatives) do
    ask = Query.asked(alternatives, :fuzzy)

    if Query.empty?(ask),
      do: :none,
      else: {ask, keywords(alternatives, :fuzzy)}
  end

  # The indexed keywords the free words resolved to, returned so the UI can show
  # what the search matched on.
  defp keywords(alternatives, mode) do
    alternatives
    |> Enum.flat_map(& &1.words)
    |> Enum.flat_map(&Keywords.resolve(&1, mode))
    |> Enum.uniq()
  end

  # The ids a search matches, in reading order — the ordering the reader pages
  # through by id.
  defp order_ids(ask), do: ask |> ranked() |> select([p], p.id) |> Repo.all()

  # The publications a search matches, in the order they are to be read: by rank,
  # then title, then id. Rows of equal rank must sort the same way every time, or
  # paging through the results would repeat or skip some. The two search modes
  # differ only in which tsquery function reads the term, so that difference is
  # all that `matches/1` and `ranking/1` carry.
  defp ranked(ask) do
    from(p in FlatPublication,
      join: d in SearchDocument,
      on: d.id == p.id,
      where: ^Query.matches(ask),
      order_by: ^[desc: Query.ranking(ask), asc: :title, asc: :id]
    )
  end

  # The full rows a search matches, in reading order — the same ranking as
  # `order_ids/1`, selected whole (or to the asked attributes) for the export
  # that takes the results all at once rather than a page at a time.
  defp asking(ask, attributes) do
    ask
    |> ranked()
    |> maybe_select(attributes)
    |> Highlight.select(attributes, ask)
  end

  # Selecting no attributes returns whole rows; naming some narrows the export to
  # those columns.
  defp maybe_select(query, []) do
    query
  end

  defp maybe_select(query, attributes) do
    select(query, [fp], map(fp, ^attributes))
  end

  # The database returns rows in whatever order it likes; the caller asked for a
  # particular one, so put them back into it and drop any that have since left.
  defp in_order(rows, ids) do
    by_id = Map.new(rows, &{&1.id, &1})
    ids |> Enum.map(&Map.get(by_id, &1)) |> Enum.reject(&is_nil/1)
  end
end
