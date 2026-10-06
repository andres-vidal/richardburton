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
    * **first translation**, **retranslation** and **reissue** — the three
      kinds of publication. A publication is a reissue when an earlier
      publication of its translation exists. Otherwise it is the first
      publication of its translation, which is a first translation when its
      translation is the work's earliest, and a retranslation when the work had
      an earlier translation. Publications are ordered by year, and by id
      within a year, and this order is taken over the whole index, so a search
      does not turn a reissue into a first translation.
    * **debut** — the year of an original author's first publication in the
      index.
    * **leading** — the names in one field that appear in the most
      publications, at most ten. Names with the same count are sorted
      alphabetically.
  """

  import Ecto.Query

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.Publication.Index
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook

  # The maximum number of entries in a leading list, in `pairs`, and in
  # `retranslated`.
  @leading 10

  # The number of countries `annual` counts on their own. Publications in any
  # other country are counted together as `elsewhere`.
  @split 2

  # The fields that hold names. Each key is the key used in the map `describe/1`
  # returns, and each value is the `FlatPublication` field it is read from.
  @names [
    original_authors: :original_authors,
    translators: :authors,
    publishers: :publishers
  ]

  # What `describe/1` returns when no publication matches.
  @nothing %{
    publications: 0,
    years: nil,
    annual: %{countries: [], years: []},
    decades: [],
    debuts: [],
    totals: %{works: 0, original_authors: 0, translators: 0, publishers: 0, countries: 0},
    original_authors: [],
    translators: [],
    publishers: [],
    pairs: [],
    countries: [],
    retranslated: [],
    sourced: 0
  }

  # Builds the query expression for the first year of the decade `year` falls
  # in, which is the year a decade is named by.
  defmacrop decade_of(year) do
    quote do: fragment("? / 10 * 10", unquote(year))
  end

  @doc """
  Returns a map of counts for the publications a term matches, or for every
  publication when the term is `nil`.

  The map has these keys:

    * `publications` — the number of publications.
    * `years` — the first and the last year of publication, or `nil` when there
      are no publications.
    * `annual` — the number of publications in each year, from the first year
      to the last, split by country. `countries` holds the codes of the two
      countries with the most publications, or fewer when there are fewer.
      Each entry of `years` holds `counts`, the publications in each of those
      countries in the same order, and `elsewhere`, the publications in no
      country of `countries`. A publication that names several of them counts
      under the first one in `countries`.
    * `decades` — the number of publications in each decade, from the first
      decade to the last, split into `first_translations`, `retranslations` and
      `reissues`. Decades with no publications are included.
    * `debuts` — the number of original authors whose debut falls in each
      decade, counting the authors the publications name. The decades run
      from the first debut to the last, including decades with none.
    * `totals` — the number of distinct works, original authors, translators,
      publishers and countries in the publications.
    * `original_authors`, `translators`, `publishers` — the leading names in
      each field, each with its number of publications. Each translator also
      has `years`, the number of publications in each year that has any,
      earliest first.
    * `pairs` — up to ten pairs of an original author and a translator, those
      that appear together in the most publications, each with that number.
      Pairs with the same count are sorted by author and then translator.
    * `countries` — every country of publication by its code, each with its
      number of publications, highest first.
    * `retranslated` — up to ten retranslated works, those with the most
      translations, each with its number of translations and `timeline`: the
      year of each translation's first publication in the index, with its
      translators, earliest first.
    * `sourced` — the number of publications that cite at least one source.

  A search is resolved to the publications it matches once, and the counts are
  read from those publications. When it matches none, no other query runs.
  """
  def describe(term \\ nil) do
    base = term |> Index.matching() |> resolved(term)

    case summary(base) do
      %{publications: 0} -> @nothing
      summary -> counts(base, summary)
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

  # Returns the map `describe/1` documents for publications that exist, from
  # `base` and its `summary`.
  defp counts(base, summary) do
    years = %{first: summary.first, last: summary.last}
    countries = countries(base)

    %{
      publications: summary.publications,
      years: years,
      annual: annual(base, years, countries),
      decades: decades(base, years),
      debuts: debuts(base),
      totals: totals(base, summary.works, countries),
      original_authors: leading(base, :original_authors),
      translators: base |> leading(:authors) |> with_years(base),
      publishers: leading(base, :publishers),
      pairs: pairs(base),
      countries: countries,
      retranslated: retranslated(base),
      sourced: summary.sourced
    }
  end

  # Counts the publications in each year from the first to the last, split by
  # the leading countries of `countries`. See `describe/1`.
  defp annual(base, %{first: first, last: last}, countries) do
    codes = countries |> Enum.take(@split) |> Enum.map(& &1.code)

    # A publication's series is the first code in `codes` that its countries
    # include, or NULL when they include none.
    tally =
      base
      |> select([fp], %{
        key: fp.year,
        series:
          fragment(
            "(SELECT code FROM unnest(?) WITH ORDINALITY AS listed(code, position) WHERE code = ANY(?) ORDER BY position LIMIT 1)",
            type(^codes, {:array, :string}),
            fp.countries
          )
      })
      |> tally()

    years =
      for year <- first..last do
        %{
          year: year,
          counts: Enum.map(codes, &Map.get(tally, {year, &1}, 0)),
          elsewhere: Map.get(tally, {year, nil}, 0)
        }
      end

    %{countries: codes, years: years}
  end

  # Counts the publications in each decade from the first to the last, by kind,
  # with counts of 0 for a decade that has none.
  defp decades(base, %{first: first, last: last}) do
    tally =
      base
      |> join(:inner, [fp], k in subquery(kinds()), on: k.id == fp.id, as: :kind)
      |> select([fp, kind: k], %{key: decade_of(fp.year), series: k.kind})
      |> tally()

    for decade <- decades_between(first, last) do
      %{
        decade: decade,
        first_translations: Map.get(tally, {decade, "first_translation"}, 0),
        retranslations: Map.get(tally, {decade, "retranslation"}, 0),
        reissues: Map.get(tally, {decade, "reissue"}, 0)
      }
    end
  end

  # Runs `query`, which selects a `key` and a `series` for each row, and returns
  # a map from each `{key, series}` pair to the number of rows that have it.
  defp tally(query) do
    query
    |> subquery()
    |> group_by([r], [r.key, r.series])
    |> select([r], {{r.key, r.series}, count()})
    |> Repo.all()
    |> Map.new()
  end

  # Returns the first year of every decade from the one `first` falls in to the
  # one `last` falls in.
  defp decades_between(first, last), do: (div(first, 10) * 10)..(div(last, 10) * 10)//10

  # A query for every publication in the index with its kind, as
  # `"first_translation"`, `"retranslation"` or `"reissue"`. See the module doc.
  #
  # `edition` numbers the publications of a translation, and `first` is the
  # translation of the work's earliest publication.
  defp kinds do
    ranked =
      from(fp in FlatPublication,
        join: p in Publication,
        on: p.id == fp.id,
        join: tb in TranslatedBook,
        on: tb.id == p.translated_book_id,
        windows: [
          translation: [partition_by: p.translated_book_id, order_by: [fp.year, fp.id]],
          work: [partition_by: tb.original_book_id, order_by: [fp.year, fp.id]]
        ],
        select: %{
          id: fp.id,
          translation: p.translated_book_id,
          edition: over(row_number(), :translation),
          first: over(first_value(p.translated_book_id), :work)
        }
      )

    from(r in subquery(ranked),
      select: %{
        id: r.id,
        kind:
          fragment(
            "CASE WHEN ? > 1 THEN 'reissue' WHEN ? = ? THEN 'first_translation' ELSE 'retranslation' END",
            r.edition,
            r.translation,
            r.first
          )
      }
    )
  end

  # Counts the original authors the publications name by the decade of their
  # debut, from the first debut's decade to the last's. A debut is read from
  # the whole index, not only from the publications counted.
  defp debuts(base) do
    debuts =
      FlatPublication
      |> named_years(:original_authors)
      |> subquery()
      |> group_by([n], n.name)
      |> select([n], %{name: n.name, year: min(n.year)})

    named = base |> names(:original_authors) |> distinct(true)

    tally =
      from(d in subquery(debuts),
        join: n in subquery(named),
        on: n.name == d.name,
        group_by: decade_of(d.year),
        select: {decade_of(d.year), count()}
      )
      |> Repo.all()
      |> Map.new()

    case Map.keys(tally) do
      [] ->
        []

      decades ->
        for decade <- decades_between(Enum.min(decades), Enum.max(decades)) do
          %{decade: decade, count: Map.get(tally, decade, 0)}
        end
    end
  end

  # Counts the distinct names in each field of `@names`, and adds `works` and
  # the number of `countries`, which are counted elsewhere.
  defp totals(base, works, countries) do
    @names
    |> Map.new(fn {name, field} ->
      {name, base |> names(field) |> distinct(true) |> subquery() |> Repo.aggregate(:count)}
    end)
    |> Map.merge(%{works: works, countries: length(countries)})
  end

  # Returns the leading names in one field, each with its number of
  # publications.
  defp leading(base, field) do
    base
    |> counted(field)
    |> limit(@leading)
    |> Repo.all()
  end

  # Adds `years` to each translator: the number of publications in each year
  # that has any, earliest first.
  defp with_years(translators, base) do
    names = Enum.map(translators, & &1.name)

    tally =
      base
      |> named_years(:authors)
      |> subquery()
      |> where([r], r.name in ^names)
      |> group_by([r], [r.name, r.year])
      |> select([r], %{name: r.name, year: r.year, count: count()})
      |> order_by([r], asc: r.year)
      |> Repo.all()
      |> Enum.group_by(& &1.name, &Map.take(&1, [:year, :count]))

    Enum.map(translators, &Map.put(&1, :years, Map.get(tally, &1.name, [])))
  end

  # Returns the pairs of an original author and a translator that appear
  # together in the most publications, each with that number.
  #
  # The authors and the translators are unnested in two steps, because Postgres
  # pairs up the elements of two arrays unnested in one select instead of
  # combining every element of one with every element of the other.
  defp pairs(base) do
    base
    |> select([fp], %{author: fragment("unnest(?)", fp.original_authors), translators: fp.authors})
    |> subquery()
    |> select([r], %{author: r.author, translator: fragment("unnest(?)", r.translators)})
    |> subquery()
    |> group_by([r], [r.author, r.translator])
    |> select([r], %{author: r.author, translator: r.translator, count: count()})
    |> order_by([r], desc: count(), asc: r.author, asc: r.translator)
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
  defp names(query, field) do
    select(query, [fp], %{name: fragment("unnest(?)", field(fp, ^field))})
  end

  # A query that returns one row for each name in each publication, with the
  # publication's year.
  defp named_years(query, field) do
    select(query, [fp], %{name: fragment("unnest(?)", field(fp, ^field)), year: fp.year})
  end

  # Returns the works that have more than one translation, each with its number
  # of translations and its timeline. It returns at most ten, sorted by
  # translations, then publications, then title.
  #
  # A translation is a translated book, so they are counted by the translated
  # book each publication belongs to, which the flat view does not carry and is
  # read from `publications`.
  defp retranslated(base) do
    leading =
      base
      |> join(:inner, [fp], p in Publication, on: p.id == fp.id, as: :publication)
      |> group_by([fp], [fp.original_title, fp.original_authors])
      |> having([publication: p], count(p.translated_book_id, :distinct) > 1)
      |> select([fp, publication: p], %{
        title: fp.original_title,
        authors: fp.original_authors,
        translations: count(p.translated_book_id, :distinct)
      })
      |> order_by([fp, publication: p],
        desc: count(p.translated_book_id, :distinct),
        desc: count(),
        asc: fp.original_title
      )
      |> limit(@leading)

    timelines = timelines(base, leading)

    leading
    |> Repo.all()
    |> Enum.map(&Map.put(&1, :timeline, Map.get(timelines, {&1.title, &1.authors}, [])))
  end

  # Returns a map from each work `works` selects, as `{original_title,
  # original_authors}`, to its timeline: the year of the first publication in
  # the whole index of each of its translations among the publications, with
  # its translators, earliest first.
  defp timelines(base, works) do
    firsts =
      from(fp in FlatPublication,
        join: p in Publication,
        on: p.id == fp.id,
        group_by: p.translated_book_id,
        select: %{translation: p.translated_book_id, year: min(fp.year)}
      )

    base
    |> join(:inner, [fp], w in subquery(works),
      on: w.title == fp.original_title and w.authors == fp.original_authors
    )
    |> join(:inner, [fp], p in Publication, on: p.id == fp.id, as: :publication)
    |> join(:inner, [publication: p], f in subquery(firsts),
      on: f.translation == p.translated_book_id,
      as: :first
    )
    |> group_by([fp, publication: p], [
      fp.original_title,
      fp.original_authors,
      p.translated_book_id
    ])
    |> select([fp, first: f], %{
      title: fp.original_title,
      authors: fp.original_authors,
      year: min(f.year),
      translators: min(fp.authors)
    })
    |> Repo.all()
    |> Enum.sort_by(&{&1.year, &1.translators})
    |> Enum.group_by(&{&1.title, &1.authors}, &Map.take(&1, [:year, :translators]))
  end
end
