defmodule RichardBurton.Publication.Insights do
  @moduledoc """
  Counts the publications in the index, the distinct works and names in them,
  and a chart of them. `describe/2` counts either every publication or the ones
  a search matches.

  The counts are read from `flat_publications`, the same rows the index lists,
  so they agree with the index. A write is included in both only after
  `RichardBurton.Publication.Index.Refresher` refreshes the index.

  Terms used here, in `RichardBurton.Publication.Chart` and in
  `RichardBurton.Publication.Kind`:

    * **work** — an original book, identified by its original title and
      original authors.
    * **translation** — one translated text of a work, identified by the work
      and its translators. Each publication belongs to one translation. A
      translation has several publications when the same text is published
      again, in another year, by another publisher or in another country.
  """

  import Ecto.Query

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication.Chart
  alias RichardBurton.Publication.Index
  alias RichardBurton.Repo

  # What `describe/2` returns when no publication matches, apart from the chart.
  @nothing %{
    publications: 0,
    years: nil,
    totals: %{works: 0, original_authors: 0, translators: 0, publishers: 0, countries: 0},
    sourced: 0
  }

  @doc """
  Returns a map of counts for the publications a term matches, or for every
  publication when the term is `nil`.

  The map has these keys:

    * `publications` — the number of publications.
    * `years` — the first and the last year of publication, or `nil` when there
      are no publications.
    * `totals` — the number of distinct works, original authors, translators,
      publishers and countries in the publications.
    * `sourced` — the number of publications that cite at least one source.
    * `chart` — what `RichardBurton.Publication.Chart.draw/2` returns for
      `chart` over the publications.

  A search is resolved to the publications it matches once, and the counts are
  read from those publications. When it matches none, no other query runs.
  """
  @spec describe(String.t() | nil, Chart.t()) :: map
  def describe(term \\ nil, chart \\ %Chart{}),
    do: describe(term, chart, term && Index.standings(term))

  @doc """
  Returns what `describe/2` returns, reading the standings of the term's words
  from `standings`, which `RichardBurton.Publication.Index.standings/1` returned
  for the term. `standings` is not read when the term is `nil`.
  """
  @spec describe(String.t() | nil, Chart.t(), map | nil) :: map
  def describe(term, chart, standings) do
    base = term |> Index.matching(standings) |> resolved(term)

    case counts(base) do
      %{publications: 0} ->
        Map.put(@nothing, :chart, Chart.nothing(chart))

      counts ->
        %{
          publications: counts.publications,
          years: %{first: counts.first, last: counts.last},
          totals: Map.take(counts, Map.keys(@nothing.totals)),
          sourced: counts.sourced,
          chart: Chart.draw(base, chart)
        }
    end
  end

  # Returns a query for the publications `query` matches, by id, so a search's
  # full-text match runs once rather than in every query that reads it. Without
  # a search, `query` is the whole index and is returned as it is.
  defp resolved(query, nil), do: query

  defp resolved(query, _term) do
    ids = query |> select([fp], fp.id) |> Repo.all()

    from(fp in FlatPublication, where: fp.id in ^ids)
  end

  # Returns every count `describe/3` reports, read with one query: how many
  # publications there are, the first and the last year, how many cite a
  # source, and how many distinct works, original authors, translators,
  # publishers and countries they hold.
  #
  # Each publication is joined to the rows of `unnest` over its four lists of
  # names. `unnest` pads the shorter lists with nulls, and `count(DISTINCT ...)`
  # skips nulls. The join repeats a publication once for each row, so the
  # publications are counted by distinct id.
  defp counts(base) do
    base
    |> join(
      :left_lateral,
      [fp],
      n in fragment(
        "SELECT * FROM unnest(?::text[], ?::text[], ?::text[], ?::text[]) AS n(original_author, translator, publisher, country)",
        fp.original_authors,
        fp.authors,
        fp.publishers,
        fp.countries
      ),
      on: true
    )
    |> select([fp, n], %{
      publications: count(fp.id, :distinct),
      first: min(fp.year),
      last: max(fp.year),
      sourced: filter(count(fp.id, :distinct), fragment("cardinality(?) > 0", fp.sources)),
      works: fragment("count(DISTINCT (?, ?))", fp.original_title, fp.original_authors),
      original_authors: count(n.original_author, :distinct),
      translators: count(n.translator, :distinct),
      publishers: count(n.publisher, :distinct),
      countries: count(n.country, :distinct)
    })
    |> Repo.one()
  end
end
