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

  Each word is matched on its own: as a prefix when the index holds words
  beginning with it, and by resemblance when it does not. So a word matched by
  resemblance does not change how the words beside it match, and the query is
  run once.

  How each word matched is its **standing** (see
  `RichardBurton.Publication.Index.Keywords`). `standings/1` looks up the
  standings of all of a term's words with one query. `search_order/2`,
  `details/3` and `matching/2` take those standings along with the term, so
  that several of them can read one lookup. Given the term alone, each of them
  looks the standings up itself.

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

  @doc "Returns `{:ok, publications}`, every publication in the index, whole."
  def all do
    all(select: [])
  end

  @doc """
  Returns `{:ok, publications}`, every publication in the index, as maps of
  the fields in `attributes`, or whole when `attributes` is empty.
  """
  def all(select: attributes) when is_list(attributes) do
    results =
      from(fp in FlatPublication)
      |> maybe_select(attributes)
      |> Repo.all()

    {:ok, results}
  end

  @doc """
  Returns the number of publications in the index. It counts the rows the
  index lists, so it includes a write only once the refresher has rebuilt the
  index, as the search does.
  """
  def count do
    Repo.aggregate(FlatPublication, :count, :id)
  end

  @doc """
  Returns `{:ok, publications}`, the publications in the index that cite no
  source, ordered by id, so the order is the same on every call.
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

  @doc "Returns what `search/2` returns for `term`, with whole rows."
  def search(term) do
    search(term, select: [])
  end

  @doc """
  Returns the publications a term matches.

  The term is split on `:or` (or `:ou`) into alternatives, and a publication
  matches if it satisfies any one of them. Within an alternative, words are
  combined with AND, so every word has to match. So searching a full title
  returns only that title, while "one title :or another" returns both.

  A word matches the indexed words it begins, so a half-typed word matches
  every word it might become. A word that begins none matches the indexed
  words it resembles, and a word that resembles none is dropped rather than
  emptying the result.

  It returns `{:ok, publications}`, every match at once, in the order
  `search_order/1` gives, as maps of the fields in `attributes`, or whole
  when `attributes` is empty. `search_order/1` and `details/2` read the same
  matches a page at a time.
  """
  def search(term, select: attributes) when is_binary(term) do
    case criteria(term, standings(term)) do
      :none -> {:ok, []}
      criteria -> {:ok, Repo.all(asking(criteria, attributes))}
    end
  end

  @doc """
  Returns the standing of each word of `term` that the search looks up, keyed
  by the word, with one query. See `RichardBurton.Publication.Index.Query.standings/1`.
  """
  defdelegate standings(term), to: Query

  @doc """
  The ids of every publication a term matches, in the order they should be read,
  or `:none` if the term matches nothing at all.

  The order is decided once, here. The reader then pages through those ids with
  `details/2` and sees a stable list, because the order was fixed at the moment
  the search ran. Without that, rows could shift, be skipped or appear twice as
  the database changed between one page and the next.
  """
  def search_order(term) when is_binary(term), do: search_order(term, standings(term))

  @doc """
  Returns what `search_order/1` returns, reading the standings of the term's
  words from `standings`, which `standings/1` returned for the term.
  """
  def search_order(term, standings) when is_binary(term) do
    case criteria(term, standings) do
      :none -> :none
      criteria -> order_ids(criteria)
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
  Returns the full rows for the given ids, in that order: one page of an
  ordering that `search_order/1` or `all_order/0` returned earlier.

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

  def details(ids, term) when is_list(ids) and is_binary(term),
    do: details(ids, term, standings(term))

  @doc """
  Returns what `details/2` returns, reading the standings of the term's words
  from `standings`, which `standings/1` returned for the term. `standings` is
  not read when the term is `nil`.
  """
  def details(ids, nil, _standings), do: details(ids, nil)

  def details(ids, term, standings) when is_list(ids) and is_binary(term) do
    from(fp in FlatPublication, where: fp.id in ^ids)
    |> Excerpt.select(term, standings)
    |> Repo.all()
    |> in_order(ids)
  end

  @doc """
  Returns what `details/2` returns for the one id `id`: a list of its row, or
  an empty list when the index does not hold it.
  """
  def detail(id, term), do: details([id], term)

  @doc "How many publications a page holds."
  def per_page, do: @per_page

  @doc """
  Returns a query for the publications a term matches, or for every publication
  when the term is `nil`. The query has no ordering.

  It always returns a query. When the term has nothing to search for, the query
  returns no rows, so callers can count over it without a separate check.
  """
  def matching(nil), do: from(fp in FlatPublication)
  def matching(term) when is_binary(term), do: matching(term, standings(term))

  @doc """
  Returns what `matching/1` returns, reading the standings of the term's words
  from `standings`, which `standings/1` returned for the term. `standings` is
  not read when the term is `nil`.
  """
  def matching(nil, _standings), do: matching(nil)

  def matching(term, standings) when is_binary(term) do
    case criteria(term, standings) do
      :none -> from(fp in FlatPublication, where: false)
      criteria -> matched(criteria)
    end
  end

  # Parses a term into criteria, reading its words' standings from `standings`.
  # Returns `:none` when the term has nothing to search for, because it is blank
  # or because none of its words matches a word in the index and it has no
  # operator.
  #
  # A term with quotes or a word excluded with `-`, and no operator, is passed
  # to Postgres as written. Its words are not widened to similar words.
  defp criteria(term, standings) do
    alternatives = Term.parse(term)

    cond do
      alternatives == [] ->
        :none

      # Quotes or exclusions, with no operator: passed to Postgres as written.
      Term.plain?(alternatives) and Query.spelled_out?(term) ->
        {:spelled_out, term}

      true ->
        criteria = Query.criteria(alternatives, standings)
        if Query.empty?(criteria), do: :none, else: criteria
    end
  end

  # The ids a search matches, in reading order. This is the ordering the reader
  # pages through by id.
  defp order_ids(criteria), do: criteria |> ranked() |> select([p], p.id) |> Repo.all()

  # The publications a search matches, in reading order: by rank, then title, then
  # id. Rows with the same rank have to sort the same way every time, or paging
  # through the results would repeat or skip some.
  defp ranked(criteria) do
    criteria
    |> matched()
    |> order_by(^[desc: Query.ranking(criteria), asc: :title, asc: :id])
  end

  # A query for the publications the criteria match. Each publication is joined
  # to its search document, which the criteria are tested against.
  defp matched(criteria) do
    from(p in FlatPublication,
      join: d in SearchDocument,
      on: d.id == p.id,
      where: ^Query.matches(criteria)
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
