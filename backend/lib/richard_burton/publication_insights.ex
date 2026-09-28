defmodule RichardBurton.Publication.Insights do
  @moduledoc """
  Counts that describe the publications in the index, either all of them or the
  ones a search matches.

  Every count is taken over the rows the index lists, so the insights and the
  index agree on how many publications there are. Both lag behind a write by the
  same amount, until the index is refreshed.

  Terms used here:

    * **work** — an original book, named by its title and its authors. A
      publication is a translation of one work.
    * **translation** — one rendering of a work, named by the work and the
      people who translated it. Several publications of a translation are the
      same text published again, by another publisher or in another country.
    * **retranslated** — a work that has more than one translation.
    * **leading** — the names that account for the most publications in one
      field, at most ten of them. Names with the same count are listed
      alphabetically.
  """

  import Ecto.Query

  alias RichardBurton.Publication.Index
  alias RichardBurton.Repo

  # How many names a leading list holds.
  @leading 10

  # The fields that hold names, as the flat publication spells them, and as the
  # description spells them.
  @names [
    original_authors: :original_authors,
    translators: :authors,
    publishers: :publishers
  ]

  @doc """
  Describes the publications a term matches, or every publication when the term
  is `nil`.

  The description holds:

    * `publications` — how many publications there are.
    * `years` — the first and the last year of publication, or `nil` when there
      are no publications.
    * `decades` — how many publications appeared in each decade, from the first
      decade to the last, a decade with none included.
    * `totals` — how many distinct works, original authors, translators,
      publishers and countries the publications name.
    * `original_authors`, `translators`, `publishers` — the leading names in
      each field, each with its count of publications.
    * `countries` — every country of publication by its code, with its count of
      publications, most first.
    * `retranslated` — the leading retranslated works, each with how many
      translations and publications it has.
    * `sourced` — how many publications cite at least one source.
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

  # The first and last year of publication, or nil when there are no
  # publications.
  defp years(base) do
    case base |> select([fp], {min(fp.year), max(fp.year)}) |> Repo.one() do
      {nil, nil} -> nil
      {first, last} -> %{first: first, last: last}
    end
  end

  # Publications per decade, from the first decade to the last. A decade is
  # named by its first year.
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

  # The decade a year falls in, named by its first year.
  defp decade(year), do: div(year, 10) * 10

  # How many distinct works, and distinct names in each field, the publications
  # hold.
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

  # The leading names in one field, with how many publications name each.
  defp leading(base, field) do
    base
    |> counted(field)
    |> limit(@leading)
    |> Repo.all()
  end

  # Every country of publication, with how many publications name each.
  defp countries(base) do
    base
    |> counted(:countries)
    |> Repo.all()
    |> Enum.map(fn %{name: code, count: count} -> %{code: code, count: count} end)
  end

  # Each name in one field, with how many publications name it, most first and
  # then alphabetically.
  defp counted(base, field) do
    base
    |> names(field)
    |> subquery()
    |> group_by([n], n.name)
    |> select([n], %{name: n.name, count: count()})
    |> order_by([n], desc: count(), asc: n.name)
  end

  # One row per name per publication, for a field that holds several names.
  defp names(base, field) do
    base
    |> exclude(:select)
    |> select([fp], %{name: fragment("unnest(?)", field(fp, ^field))})
  end

  # The leading works that have more than one translation, with how many
  # translations and publications each has.
  defp retranslated(base) do
    base
    |> group_by([fp], [fp.original_title, fp.original_authors])
    |> having([fp], count(fp.translated_book_fingerprint, :distinct) > 1)
    |> select([fp], %{
      title: fp.original_title,
      authors: fp.original_authors,
      translations: count(fp.translated_book_fingerprint, :distinct),
      publications: count()
    })
    |> order_by([fp],
      desc: count(fp.translated_book_fingerprint, :distinct),
      desc: count(),
      asc: fp.original_title
    )
    |> limit(@leading)
    |> Repo.all()
  end

  # How many publications cite at least one source.
  defp sourced(base) do
    base
    |> where([fp], fragment("cardinality(?) > 0", fp.sources))
    |> Repo.aggregate(:count)
  end
end
