defmodule RichardBurton.Publication.Chart do
  @moduledoc """
  Describes a chart of publications, and counts what the chart shows.

  A chart counts **items** in **groups**. An item is what `count` names, and a
  group is what `by` names. A group counts each item once, however many of its
  publications hold it. A chart can also split each group into **series**, or
  into **steps** of time. `parse/1` reads a chart from request parameters, and
  `draw/2` counts it.

  A chart has these fields:

    * `count` — the items: `:publications`, `:works`, `:translations`,
      `:original_authors`, `:translators` or `:publishers`. Works
      and translations are those `RichardBurton.Publication.Insights` defines.
    * `by` — the groups: `:year`, `:decade`, `:kind`, `:country`,
      `:original_author`, `:translator`, `:publisher`, `:work`, or `:pair`,
      which is an original author and a translator together. A publication is
      in one year, decade, kind and work, and in one group for each country,
      name or pair it holds. A decade is named by its first year.
    * `split` — the series: `nil` for none, `:kind`, or `:country`. A
      publication is in one series. With `:country`, the series are the
      leading countries and one more for every other country, and a
      publication is in the first leading country it holds. Items other than
      publications can be in several series of a group, so the counts of a
      group's series can add up to more than its total.
    * `over` — the steps: `nil` for none, `:year` or `:decade`. It needs a `by`
      that is not a year or a decade, and no `split`.
    * `first` — when true, each item is counted at its first appearance only:
      in the group and step of its earliest publication in the whole index, by
      year and then by id, and in that publication's series. Within a group of
      names, works, pairs or countries, an item's earliest publication is the
      earliest in that group. Only the items the counted publications hold are
      counted, even when their first appearance is outside them. It needs `by`
      or `over` to be a year or a decade.
    * `top` — how many groups to keep, or `nil` to keep them all.
    * `least` — the fewest items a group needs to be kept, or `nil` to keep
      groups of any size.

  Groups by year or decade are listed by time, and groups by kind in the order
  of `@kinds`. They cannot take `top` or `least`. Every other group is ranked,
  with the most items first. Groups with as many items are sorted by their
  number of publications, most first, and then by their names.

  Terms used here:

    * **kind** — a publication is a `"reissue"` when an earlier publication of
      its translation exists. Otherwise it is the first publication of its
      translation, which is a `"first_translation"` when its translation is the
      work's earliest, and a `"retranslation"` when the work had an earlier
      translation. Publications are ordered by year, and by id within a year,
      over the whole index, so a search does not turn a reissue into a first
      translation.
    * **leading countries** — the two countries with the most publications
      among those counted. Countries with the same count are sorted by code.
  """

  use Ecto.Schema

  import Ecto.Changeset
  import Ecto.Query

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook

  # The kinds of publication, in the order their groups and series are listed.
  @kinds ["first_translation", "retranslation", "reissue"]

  # The number of leading countries.
  @leading 2

  # The groupings by time. The others are ranked.
  @times [:year, :decade]

  # The `FlatPublication` field each grouping or count of names unnests.
  @names %{
    country: :countries,
    original_author: :original_authors,
    original_authors: :original_authors,
    translator: :authors,
    translators: :authors,
    publisher: :publishers,
    publishers: :publishers
  }

  # Builds the query expression for the first year of the decade `year` falls
  # in, which is the year a decade is named by.
  defmacrop decade_of(year) do
    quote do: fragment("? / 10 * 10", unquote(year))
  end

  @primary_key false
  embedded_schema do
    field(:count, Ecto.Enum,
      values: [
        :publications,
        :works,
        :translations,
        :original_authors,
        :translators,
        :publishers
      ],
      default: :publications
    )

    field(:by, Ecto.Enum,
      values: [
        :year,
        :decade,
        :kind,
        :country,
        :original_author,
        :translator,
        :publisher,
        :work,
        :pair
      ],
      default: :year
    )

    field(:split, Ecto.Enum, values: [:kind, :country])
    field(:over, Ecto.Enum, values: @times)
    field(:first, :boolean, default: false)
    field(:top, :integer)
    field(:least, :integer)
  end

  @type t :: %__MODULE__{}

  @doc """
  Reads a chart from request parameters, with string keys. A missing field
  takes its default, and parameters that are not fields are ignored.

  Returns `{:ok, chart}`, or `{:error, errors}` with `:invalid` for each field
  whose value is not one of its values, or does not go with the other fields.
  """
  @spec parse(map) :: {:ok, t} | {:error, %{atom => :invalid}}
  def parse(params) do
    %__MODULE__{}
    |> cast(params, [:count, :by, :split, :over, :first, :top, :least])
    |> validate_number(:top, greater_than: 0)
    |> validate_number(:least, greater_than: 0)
    |> validate_fields()
    |> apply_action(:parse)
    |> case do
      {:ok, chart} -> {:ok, chart}
      {:error, changeset} -> {:error, Map.new(changeset.errors, &{elem(&1, 0), :invalid})}
    end
  end

  # Adds an error to each field that does not go with the others. See the
  # module doc.
  defp validate_fields(changeset) do
    by = get_field(changeset, :by)
    over = get_field(changeset, :over)

    changeset
    |> refuse(:over, over != nil and (by in @times or get_field(changeset, :split) != nil))
    |> refuse(:first, get_field(changeset, :first) and by not in @times and over == nil)
    |> refuse(:top, get_field(changeset, :top) != nil and not ranked?(by))
    |> refuse(:least, get_field(changeset, :least) != nil and not ranked?(by))
  end

  # Adds an error to `field` when `invalid?` is true.
  defp refuse(changeset, field, invalid?) do
    if invalid?, do: add_error(changeset, field, "is invalid"), else: changeset
  end

  # Returns whether the groups of `by` are ranked by their totals.
  defp ranked?(by), do: by not in [:kind | @times]

  @doc """
  Counts `chart` over the publications `base` selects, a query of
  `FlatPublication`.

  Returns a map with these keys:

    * `series` — the series, in order. They are `[nil]` without a split, the
      kinds with `split: :kind`, and the codes of the leading countries
      followed by `nil` for every other country with `split: :country`.
    * `groups` — the groups, in the order the module doc gives. Groups by year
      or decade run from the earliest to the latest, including those with no
      items, and groups by kind include all three kinds. Each group has `key`,
      `total`, the number of distinct items in the group, and `counts`, the
      number in each series, in the order of `series`. With `over`, it also
      has `steps`.
    * `hidden` — the number of ranked groups that `top` leaves out.

  A group's `key` is a year or a decade as an integer, a kind, a country code
  or a name as a string, `%{title: title, authors: authors}` for a work, and
  `%{author: author, translator: translator}` for a pair.

  Each step has `at`, its year or decade, `total`, the number of distinct items
  in the group in that step, and `items`, the names of those items. An item's
  names are a publication's title, a work's original title, a translation's
  translators, or the one name or country code it is. Items with the same
  names are listed once. A group's steps are only those with items, earliest
  first.
  """
  @spec draw(Ecto.Queryable.t(), t) :: map
  def draw(base, chart) do
    leading = leading(base, chart.split)
    held = held(base, chart, leading)
    rows = rows(held, chart, leading)
    ranked = ranked(rows, held, chart)
    groups = Repo.all(ranked)

    counts = counts(rows, ranked, chart)
    steps = steps(rows, ranked, chart)

    %{
      series: series(chart.split, leading),
      groups:
        groups
        |> filled(chart.by)
        |> Enum.map(&group(&1, chart, counts, steps, leading)),
      hidden: hidden(groups)
    }
  end

  @doc """
  Returns what `draw/2` returns for `chart` when no publication is counted,
  without reading the database.
  """
  @spec nothing(t) :: map
  def nothing(chart) do
    %{
      series: series(chart.split, []),
      groups:
        []
        |> filled(chart.by)
        |> Enum.map(&group(&1, chart, chart.split && %{}, chart.over && %{}, [])),
      hidden: 0
    }
  end

  # Returns the codes of the leading countries when the split is by country.
  defp leading(base, :country) do
    base
    |> select([fp], %{code: fragment("unnest(?)", fp.countries)})
    |> subquery()
    |> group_by([c], c.code)
    |> order_by([c], desc: count(), asc: c.code)
    |> limit(@leading)
    |> select([c], c.code)
    |> Repo.all()
  end

  defp leading(_base, _split), do: []

  # Returns the series `draw/2` documents.
  defp series(nil, _leading), do: [nil]
  defp series(:kind, _leading), do: @kinds
  defp series(:country, leading), do: leading ++ [nil]

  # Returns a query for the rows to count, from `held`, the rows of the
  # publications counted. See `held/3` for their fields.
  #
  # Without `first`, they are the rows of `held`. With `first`, they are read
  # from the whole index, and only the row of each item's first appearance in
  # each category is kept, for the items and categories that `held` holds.
  defp rows(held, %{first: false}, _leading), do: held

  defp rows(held, chart, leading) do
    ranked =
      from(r in subquery(held(FlatPublication, chart, leading)),
        windows: [appearance: [partition_by: [r.category, r.item], order_by: [r.year, r.id]]],
        select: merge(r, %{appearance: over(row_number(), :appearance)})
      )

    from(r in subquery(ranked),
      as: :row,
      where: r.appearance == 1,
      where:
        exists(
          from(h in subquery(held),
            where: h.category == parent_as(:row).category and h.item == parent_as(:row).item
          )
        )
    )
  end

  # Returns a query with one row for each item, category and series that a
  # publication of `source` holds. Each row has the publication's `id` and
  # `year`, and these fields:
  #
  #   * `item`, which identifies the item, and `label`, its names.
  #   * `category`, the group when the groups are not years or decades, and an
  #     empty list when they are.
  #   * `key`, which identifies the group as a list of strings.
  #   * `step`, the year or decade with `over`, and `nil` without it.
  #   * `series`, the series, and `nil` without a split.
  defp held(source, chart, leading) do
    from(fp in source, as: :publication, select: %{id: fp.id, year: fp.year})
    |> item(chart.count)
    |> category(chart.by)
    |> stepped(chart.over)
    |> in_series(chart.split, leading)
  end

  # Adds `item` and `label` for the items `count` names. See `draw/2`.
  defp item(query, :publications) do
    select_merge(query, [publication: fp], %{
      item: type(fp.id, :string),
      label: fragment("ARRAY[?]::text[]", fp.title)
    })
  end

  defp item(query, :works) do
    query
    |> with_book()
    |> select_merge([publication: fp, book: tb], %{
      item: type(tb.original_book_id, :string),
      label: fragment("ARRAY[?]::text[]", fp.original_title)
    })
  end

  defp item(query, :translations) do
    query
    |> with_book()
    |> select_merge([publication: fp, link: p], %{
      item: type(p.translated_book_id, :string),
      label: type(fp.authors, {:array, :string})
    })
  end

  defp item(query, count) do
    query
    |> join(
      :inner_lateral,
      [publication: fp],
      n in fragment(
        "SELECT unnest(?)::text AS name",
        field(fp, ^@names[count])
      ),
      on: true,
      as: :item_name
    )
    |> select_merge([item_name: n], %{
      item: n.name,
      label: fragment("ARRAY[?]", n.name)
    })
  end

  # Adds `category` and `key` for the groups `by` names. See `held/3`. A
  # grouping that is not by time joins `:group`, one row for each group a
  # publication is in, whose `key` is both fields.
  defp category(query, :year) do
    select_merge(query, [publication: fp], %{
      category: type(^[], {:array, :string}),
      key: fragment("ARRAY[?::text]", fp.year)
    })
  end

  defp category(query, :decade) do
    select_merge(query, [publication: fp], %{
      category: type(^[], {:array, :string}),
      key: fragment("ARRAY[(?)::text]", decade_of(fp.year))
    })
  end

  defp category(query, :kind) do
    query
    |> with_kind()
    |> join(:inner_lateral, [kind: k], g in fragment("SELECT ARRAY[?]::text[] AS key", k.kind),
      on: true,
      as: :group
    )
    |> by_group()
  end

  defp category(query, :work) do
    query
    |> join(
      :inner_lateral,
      [publication: fp],
      g in fragment(
        "SELECT ARRAY[?]::text[] || ?::text[] AS key",
        fp.original_title,
        fp.original_authors
      ),
      on: true,
      as: :group
    )
    |> by_group()
  end

  defp category(query, :pair) do
    query
    |> join(
      :inner_lateral,
      [publication: fp],
      g in fragment(
        "SELECT ARRAY[author, translator]::text[] AS key FROM unnest(?) AS author, unnest(?) AS translator",
        fp.original_authors,
        fp.authors
      ),
      on: true,
      as: :group
    )
    |> by_group()
  end

  defp category(query, by) do
    query
    |> join(
      :inner_lateral,
      [publication: fp],
      g in fragment(
        "SELECT ARRAY[name]::text[] AS key FROM unnest(?) AS name",
        field(fp, ^@names[by])
      ),
      on: true,
      as: :group
    )
    |> by_group()
  end

  # Adds `category` and `key`, both the key of the `:group` row.
  defp by_group(query), do: select_merge(query, [group: g], %{category: g.key, key: g.key})

  # Adds `series` for the split. See the module doc.
  defp in_series(query, nil, _leading) do
    select_merge(query, %{series: type(^nil, :string)})
  end

  defp in_series(query, :kind, _leading) do
    query
    |> with_kind()
    |> select_merge([kind: k], %{series: k.kind})
  end

  defp in_series(query, :country, leading) do
    select_merge(query, [publication: fp], %{
      series:
        fragment(
          "(SELECT code FROM unnest(?::text[]) WITH ORDINALITY AS listed(code, position) WHERE code = ANY(?) ORDER BY position LIMIT 1)",
          type(^leading, {:array, :string}),
          fp.countries
        )
    })
  end

  # Joins each publication's `Publication` as `:link` and its `TranslatedBook`
  # as `:book`, unless they are joined already.
  defp with_book(query) do
    if has_named_binding?(query, :book) do
      query
    else
      query
      |> join(:inner, [publication: fp], p in Publication, on: p.id == fp.id, as: :link)
      |> join(:inner, [link: p], tb in TranslatedBook,
        on: tb.id == p.translated_book_id,
        as: :book
      )
    end
  end

  # Joins each publication's kind as `:kind`, unless it is joined already.
  defp with_kind(query) do
    if has_named_binding?(query, :kind) do
      query
    else
      join(query, :inner, [publication: fp], k in subquery(kinds()), on: k.id == fp.id, as: :kind)
    end
  end

  # A query for every publication in the index with its kind. See the module
  # doc.
  #
  # `edition` numbers the publications of a translation, and `first` is the
  # translation of the work's earliest publication.
  defp kinds do
    ranked =
      from(fp in FlatPublication, as: :publication)
      |> with_book()
      |> windows([publication: fp, link: p, book: tb],
        translation: [partition_by: p.translated_book_id, order_by: [fp.year, fp.id]],
        work: [partition_by: tb.original_book_id, order_by: [fp.year, fp.id]]
      )
      |> select([publication: fp, link: p], %{
        id: fp.id,
        translation: p.translated_book_id,
        edition: over(row_number(), :translation),
        first: over(first_value(p.translated_book_id), :work)
      })

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

  # Adds `step`.
  defp stepped(query, nil), do: select_merge(query, %{step: type(^nil, :integer)})
  defp stepped(query, :year), do: select_merge(query, [publication: fp], %{step: fp.year})

  defp stepped(query, :decade) do
    select_merge(query, [publication: fp], %{step: decade_of(fp.year)})
  end

  # Returns a query for the groups to keep, each with its `key`, its `total`,
  # and `groups`, the number of groups before `top` applies. Ranked groups are
  # sorted by their totals, then by their number of publications in `held`,
  # and then by key, and `least` and `top` apply to them.
  defp ranked(rows, held, chart) do
    query =
      from(r in subquery(rows),
        group_by: r.key,
        select: %{key: r.key, total: count(r.item, :distinct), groups: over(count())}
      )

    if ranked?(chart.by) do
      publications =
        from(h in subquery(held),
          group_by: h.key,
          select: %{key: h.key, count: count(h.id, :distinct)}
        )

      query
      |> join(:inner, [r], p in subquery(publications), on: p.key == r.key)
      |> group_by([r, p], p.count)
      |> order_by([r, p], desc: count(r.item, :distinct), desc: p.count, asc: r.key)
      |> at_least(chart.least)
      |> at_most(chart.top)
    else
      query
    end
  end

  defp at_least(query, nil), do: query
  defp at_least(query, least), do: having(query, [r], count(r.item, :distinct) >= ^least)

  defp at_most(query, nil), do: query
  defp at_most(query, top), do: limit(query, ^top)

  # Returns a map from each `{key, series}` of the kept groups to its number of
  # distinct items, or `nil` without a split, when a group's one count is its
  # total.
  defp counts(_rows, _ranked, %{split: nil}), do: nil

  defp counts(rows, ranked, _chart) do
    from(r in subquery(rows),
      join: g in subquery(ranked),
      on: g.key == r.key,
      group_by: [r.key, r.series],
      select: {{r.key, r.series}, count(r.item, :distinct)}
    )
    |> Repo.all()
    |> Map.new()
  end

  # Returns a map from each kept group's key to its steps, or `nil` without
  # `over`. See `draw/2`.
  defp steps(_rows, _ranked, %{over: nil}), do: nil

  defp steps(rows, ranked, _chart) do
    from(r in subquery(rows),
      join: g in subquery(ranked),
      on: g.key == r.key,
      group_by: [r.key, r.step],
      order_by: [r.key, r.step],
      select:
        {r.key,
         %{
           at: r.step,
           total: count(r.item, :distinct),
           items:
             fragment("jsonb_agg(DISTINCT to_jsonb(?) ORDER BY to_jsonb(?))", r.label, r.label)
         }}
    )
    |> Repo.all()
    |> Enum.group_by(&elem(&1, 0), &elem(&1, 1))
  end

  # Returns the groups in the order `draw/2` documents, adding the years or
  # decades with no items between the earliest and the latest, and the kinds
  # with none.
  defp filled(groups, by) when by in @times do
    keyed = Map.new(groups, &{&1.key, &1})
    step = if by == :decade, do: 10, else: 1

    case Enum.map(groups, &(&1.key |> hd() |> String.to_integer())) do
      [] ->
        []

      times ->
        for time <- Range.new(Enum.min(times), Enum.max(times), step) do
          Map.get(keyed, [Integer.to_string(time)], %{key: [Integer.to_string(time)], total: 0})
        end
    end
  end

  defp filled(groups, :kind) do
    keyed = Map.new(groups, &{&1.key, &1})
    Enum.map(@kinds, &Map.get(keyed, [&1], %{key: [&1], total: 0}))
  end

  defp filled(groups, _by), do: groups

  # Returns a group as `draw/2` documents it, from its row of `ranked/3`, the
  # map `counts/3` returns and the map `steps/3` returns.
  defp group(%{key: key, total: total}, chart, counts, steps, leading) do
    group = %{
      key: decoded(key, chart.by),
      total: total,
      counts:
        if(counts,
          do: Enum.map(series(chart.split, leading), &Map.get(counts, {key, &1}, 0)),
          else: [total]
        )
    }

    if steps, do: Map.put(group, :steps, Map.get(steps, key, [])), else: group
  end

  # Returns a group's key in the form `draw/2` documents.
  defp decoded([time], by) when by in @times, do: String.to_integer(time)
  defp decoded([title | authors], :work), do: %{title: title, authors: authors}
  defp decoded([author, translator], :pair), do: %{author: author, translator: translator}
  defp decoded([name], _by), do: name

  # Returns the number of groups that `top` left out.
  defp hidden([]), do: 0
  defp hidden(kept = [%{groups: groups} | _]), do: groups - length(kept)
end
