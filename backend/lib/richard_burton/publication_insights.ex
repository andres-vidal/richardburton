defmodule RichardBurton.Publication.Insights do
  @moduledoc """
  Counts the publications in the index, and the distinct works and names in
  them. `describe/1` counts either every publication or the ones a search
  matches.

  The counts are read from `flat_publications`, the same rows the index lists,
  so they agree with the index. A write is included in both only after
  `RichardBurton.Publication.Index.Refresher` refreshes the index.

  Terms used here:

    * **work** — an original book, identified by its original title and
      original authors.
    * **translation** — one translated text of a work, identified by the work
      and its translators. Each publication belongs to one translation. A
      translation has several publications when the same text is published
      again, in another year, by another publisher or in another country.
    * **retranslated** — describes a work that has more than one translation.
    * **leading** — the names in one field that appear in the most
      publications, at most ten. Names with the same count are sorted
      alphabetically.
  """

  import Ecto.Query

  alias RichardBurton.Publication
  alias RichardBurton.Publication.Index
  alias RichardBurton.Repo

  # The maximum number of entries in a leading list, and in `retranslated`.
  @leading 10

  # The fields that hold names. Each key is the key used in the map `describe/1`
  # returns, and each value is the `FlatPublication` field it is read from.
  @names [
    original_authors: :original_authors,
    translators: :authors,
    publishers: :publishers
  ]

  @doc """
  Returns a map of counts for the publications a term matches, or for every
  publication when the term is `nil`.

  The map has these keys:

    * `publications` — the number of publications.
    * `years` — the first and the last year of publication, or `nil` when there
      are no publications.
    * `decades` — the number of publications in each decade, from the first
      decade to the last. Decades with no publications are included.
    * `totals` — the number of distinct works, original authors, translators,
      publishers and countries in the publications.
    * `original_authors`, `translators`, `publishers` — the leading names in
      each field, each with its number of publications.
    * `countries` — every country of publication by its code, each with its
      number of publications, highest first.
    * `retranslated` — up to ten retranslated works, those with the most
      translations, each with its number of translations and publications.
    * `sourced` — the number of publications that cite at least one source.
  """
  def describe(term \\ nil) do
    base = Index.matching(term)
    years = years(base)

    %{
      publications: Repo.aggregate(base, :count),
      years: years,
      decades: decades(base, years),
      totals: totals(base),
      original_authors: leading(base, :original_authors),
      translators: leading(base, :authors),
      publishers: leading(base, :publishers),
      countries: countries(base),
      retranslated: retranslated(base),
      sourced: sourced(base)
    }
  end

  # Returns the first and last year of publication, or nil when there are no
  # publications.
  defp years(base) do
    case base |> select([fp], {min(fp.year), max(fp.year)}) |> Repo.one() do
      {nil, nil} -> nil
      {first, last} -> %{first: first, last: last}
    end
  end

  # Counts the publications in each decade from the first to the last, with a
  # count of 0 for a decade that has none. A decade is named by its first year.
  # Returns an empty list when there are no years.
  defp decades(_base, nil), do: []

  defp decades(base, %{first: first, last: last}) do
    counts =
      base
      |> group_by([fp], fragment("? / 10 * 10", fp.year))
      |> select([fp], {fragment("? / 10 * 10", fp.year), count()})
      |> Repo.all()
      |> Map.new()

    for decade <- decade(first)..decade(last)//10 do
      %{decade: decade, count: Map.get(counts, decade, 0)}
    end
  end

  # Returns the first year of the decade a year falls in.
  defp decade(year), do: div(year, 10) * 10

  # Counts the distinct works, and the distinct names in each field of `@names`
  # and in `countries`.
  defp totals(base) do
    works =
      base
      |> distinct([fp], [fp.original_title, fp.original_authors])
      |> select([fp], fp.id)
      |> subquery()
      |> Repo.aggregate(:count)

    names =
      Map.new([{:countries, :countries} | @names], fn {name, field} ->
        {name, base |> names(field) |> distinct(true) |> subquery() |> Repo.aggregate(:count)}
      end)

    Map.put(names, :works, works)
  end

  # Returns the leading names in one field, each with its number of
  # publications.
  defp leading(base, field) do
    base
    |> counted(field)
    |> limit(@leading)
    |> Repo.all()
  end

  # Returns every country code in the publications, each with its number of
  # publications.
  defp countries(base) do
    base
    |> counted(:countries)
    |> Repo.all()
    |> Enum.map(fn %{name: code, count: count} -> %{code: code, count: count} end)
  end

  # A query for each name in one field with its number of publications, sorted
  # by that number, highest first, and then by name.
  defp counted(base, field) do
    base
    |> names(field)
    |> subquery()
    |> group_by([n], n.name)
    |> select([n], %{name: n.name, count: count()})
    |> order_by([n], desc: count(), asc: n.name)
  end

  # A query that returns one row for each name in each publication, by
  # unnesting an array field.
  defp names(base, field) do
    base
    |> exclude(:select)
    |> select([fp], %{name: fragment("unnest(?)", field(fp, ^field))})
  end

  # Returns the works that have more than one translation, each with its number
  # of translations and publications. It returns at most ten, sorted by
  # translations, then publications, then title.
  #
  # A translation is a translated book, so they are counted by the translated
  # book each publication belongs to, which the flat view does not carry and is
  # read from `publications`.
  defp retranslated(base) do
    base
    |> join(:inner, [fp], p in Publication, on: p.id == fp.id, as: :publication)
    |> group_by([fp], [fp.original_title, fp.original_authors])
    |> having([publication: p], count(p.translated_book_id, :distinct) > 1)
    |> select([fp, publication: p], %{
      title: fp.original_title,
      authors: fp.original_authors,
      translations: count(p.translated_book_id, :distinct),
      publications: count()
    })
    |> order_by([fp, publication: p],
      desc: count(p.translated_book_id, :distinct),
      desc: count(),
      asc: fp.original_title
    )
    |> limit(@leading)
    |> Repo.all()
  end

  # Counts the publications that cite at least one source.
  defp sourced(base) do
    base
    |> where([fp], fragment("cardinality(?) > 0", fp.sources))
    |> Repo.aggregate(:count)
  end
end
