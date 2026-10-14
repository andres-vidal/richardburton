defmodule RichardBurton.Publication.Insights do
  @moduledoc """
  Counts the publications in the index, the distinct works and names in them,
  and a chart of them. `describe/2` counts either every publication or the ones
  a search matches.

  The counts are read from `flat_publications`, the same rows the index lists,
  so they agree with the index. A write is included in both only after
  `RichardBurton.Publication.Index.Refresher` refreshes the index.

  Terms used here and in `RichardBurton.Publication.Chart`:

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

  # The fields that hold names. Each key is the key used in `totals`, and each
  # value is the `FlatPublication` field it is read from.
  @names [
    original_authors: :original_authors,
    translators: :authors,
    publishers: :publishers,
    countries: :countries
  ]

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
  def describe(term \\ nil, chart \\ %Chart{}) do
    base = term |> Index.matching() |> resolved(term)

    case summary(base) do
      %{publications: 0} ->
        Map.put(@nothing, :chart, Chart.nothing(chart))

      summary ->
        %{
          publications: summary.publications,
          years: %{first: summary.first, last: summary.last},
          totals: totals(base, summary.works),
          sourced: summary.sourced,
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

  # Returns the counts that one query can read for all the publications: how
  # many there are, the first and last year, how many cite a source, and how
  # many distinct works they hold.
  defp summary(base) do
    base
    |> select([fp], %{
      publications: count(),
      first: min(fp.year),
      last: max(fp.year),
      sourced: filter(count(), fragment("cardinality(?) > 0", fp.sources)),
      works: fragment("count(DISTINCT (?, ?))", fp.original_title, fp.original_authors)
    })
    |> Repo.one()
  end

  # Counts the distinct names in each field of `@names`, and adds `works`, which
  # is counted elsewhere.
  defp totals(base, works) do
    @names
    |> Map.new(fn {name, field} ->
      {name,
       base
       |> select([fp], %{name: fragment("unnest(?)", field(fp, ^field))})
       |> distinct(true)
       |> subquery()
       |> Repo.aggregate(:count)}
    end)
    |> Map.put(:works, works)
  end
end
