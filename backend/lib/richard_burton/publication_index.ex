defmodule RichardBurton.Publication.Index do
  @moduledoc """
  Full-text search over the publication index.

  A term is split on `:or` (or `:ou`) into **alternatives**, and a publication
  matches if it satisfies any one of them.

  Each alternative contains free words and operators. Free words are matched one
  at a time and combined with AND, so every word has to match. An operator
  restricts its value to a single field:

      title:casmurro            search the title only
      autor:machado             search the author, written in Portuguese
      year:1950-1960            a range of years
      -country:US               exclude
      title:"dom casmurro"      these words, in this order

  An alternative matches when both its words and its operators match.

  Terms used here, which also appear as tags in the code:

    * **spelled out** — a term that uses quotes or a leading `-` but contains no
      operator. Postgres already understands that syntax, so the term is handed
      to `websearch_to_tsquery` as written instead of being parsed here. Tagged
      `{:spelled_out, term}`.
    * **criteria** — what a term becomes once it has been read: either
      `{:spelled_out, term}` or `{:alternatives, alternatives}`. `matches/1` and
      `ranking/1` are built from it, and it is the only thing that differs
      between the two ways of reading a term.

  Every word is read once, on its own: it matches as a prefix if the index holds
  words beginning with it, and by resemblance if it does not. A word that has to
  fall back therefore does not drag the words beside it along with it, and the
  query is built and run once rather than twice.

  Both ways of reading a term match against a `tsvector` whose accents have been
  stripped, so the term has its accents stripped too before it is compared. See
  `RichardBurton.Publication.Index.Term` for the vocabulary a term is written in
  and the names each operator answers to.
  """

  import Ecto.Query

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication.Index.SearchDocument
  alias RichardBurton.Publication.Index.Excerpt
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

  # The number of publications in the index.
  #
  # Counted from the same rows the index lists, so it lags behind writes by as much
  # as the search does. That is deliberate: it matches what a client would get by
  # fetching the full list right now.
  def count() do
    Repo.aggregate(FlatPublication, :count, :id)
  end

  @doc """
  Publications that have no sources recorded, ordered by id. This is the queue
  the sources backfill works through, and the order has to be stable so it can be
  resumed.
  """
  def without_sources do
    results =
      from(fp in FlatPublication,
        where: fragment("cardinality(?) = 0", fp.sources),
        order_by: [asc: fp.id]
      )
      |> Repo.all()

    {:ok, results}
  end

  def search(term) do
    search(term, select: [])
  end

  @doc """
  The publications a term matches.

  The term is split on `:or` (or `:ou`) into alternatives, and a publication
  matches if it satisfies any one of them. Within an alternative, words are
  combined with AND, so every word has to match. That is why searching a full
  title returns only that title, while "one title or another" returns both.

  A single word only has to match one of the indexed words it could be, so a
  half-typed word matches anything it might still become. The term is tried as
  typed first; only if that matches nothing is it retried fuzzily, and a word
  that matches nothing is then dropped rather than emptying the whole result.

  This returns everything at once, with no paging, for callers that need the
  whole result — the CSV export downloads the database rather than a page of it.
  A reader goes through `search_order/1` and `details/2` instead.
  """
  def search(term, select: attributes) when is_binary(term) do
    case answering(term) do
      :none -> {:ok, []}
      {criteria, _ids} -> {:ok, Repo.all(asking(criteria, attributes))}
    end
  end

  @doc """
  The ids of every publication a term matches, in the order they should be read,
  or `:none` if the term matches nothing at all.

  The order is decided once, here. The reader then pages through those ids with
  `details/2` and sees a stable list, because the order was fixed at the moment
  the search ran. Without that, rows could shift, be skipped or appear twice as
  the database changed between one page and the next.
  """
  def search_order(term) when is_binary(term) do
    case answering(term) do
      :none -> :none
      {_ask, ids} -> ids
    end
  end

  @doc """
  The ids of every publication, in the order the index lists them: by title, then
  by id. The equivalent of `search_order/1` for a reader who is browsing rather
  than searching.
  """
  def all_order do
    from(fp in FlatPublication, order_by: [asc: fp.title, asc: fp.id], select: fp.id)
    |> Repo.all()
  end

  @doc """
  The full rows for the given ids, in that order — one page of an ordering that
  `search_order/1` or `all_order/0` returned earlier.

  Pass `nil` as the term for a plain listing. Pass the term itself and each row
  comes back with an excerpt of every field that matched it.

  An id that is no longer in the database is left out. That is what a deletion
  looks like after the order was fixed: a gap in the page, rather than rows
  shifting up or repeating.
  """
  def details(ids, term \\ nil)

  def details(ids, nil) when is_list(ids) do
    from(fp in FlatPublication, where: fp.id in ^ids)
    |> Repo.all()
    |> in_order(ids)
  end

  def details(ids, term) when is_list(ids) and is_binary(term) do
    from(fp in FlatPublication, where: fp.id in ^ids)
    |> Excerpt.select(term)
    |> Repo.all()
    |> in_order(ids)
  end

  @doc """
  The full row for one id, or an empty list when there is none.

  Gives what `details/2` gives, and for a search also marks each source on its
  own, which a page showing the whole provenance list needs and a page listing
  rows does not.
  """
  def detail(id, nil), do: details([id], nil)

  def detail(id, term) when is_binary(term) do
    from(fp in FlatPublication, where: fp.id == ^id)
    |> Excerpt.select(term, sources: true)
    |> Repo.all()
  end

  @doc "How many publications a page holds."
  def per_page, do: @per_page

  # The criteria that answer a term and the ids they matched, or `:none` if nothing
  # in the index matches.
  #
  # A term that quotes a phrase or excludes a word with `-` is saying exactly what
  # it wants, so it is passed to Postgres as written and never widened.
  defp answering(term) do
    alternatives = Term.parse(term)

    cond do
      alternatives == [] ->
        :none

      # Quotes or exclusions, with no operator: passed to Postgres as written.
      Term.plain?(alternatives) and Query.spelled_out?(term) ->
        criteria = {:spelled_out, term}
        {criteria, order_ids(criteria)}

      true ->
        criteria = Query.criteria(alternatives)

        if Query.empty?(criteria),
          do: :none,
          else: {criteria, order_ids(criteria)}
    end
  end

  # The ids a search matches, in reading order. This is the ordering the reader
  # pages through by id.
  defp order_ids(criteria), do: criteria |> ranked() |> select([p], p.id) |> Repo.all()

  # The publications a search matches, in reading order: by rank, then title, then
  # id. Rows with the same rank have to sort the same way every time, or paging
  # through the results would repeat or skip some.
  defp ranked(criteria) do
    from(p in FlatPublication,
      join: d in SearchDocument,
      on: d.id == p.id,
      where: ^Query.matches(criteria),
      order_by: ^[desc: Query.ranking(criteria), asc: :title, asc: :id]
    )
  end

  # The full rows a search matches, in the same order as `order_ids/1`, selected
  # whole or narrowed to the named attributes. Used by the export, which takes the
  # results all at once rather than a page at a time.
  defp asking(criteria, attributes) do
    criteria |> ranked() |> maybe_select(attributes)
  end

  # An empty attribute list returns whole rows. Naming attributes narrows the
  # export to just those columns.
  defp maybe_select(query, []) do
    query
  end

  defp maybe_select(query, attributes) do
    select(query, [fp], map(fp, ^attributes))
  end

  # Puts rows into the order the given ids are in, dropping any id that is no longer
  # in the database. The database returns them in whatever order it likes.
  defp in_order(rows, ids) do
    by_id = Map.new(rows, &{&1.id, &1})
    ids |> Enum.map(&Map.get(by_id, &1)) |> Enum.reject(&is_nil/1)
  end
end
