defmodule RichardBurton.Publication.Duplicates do
  @moduledoc """
  Finds publications that are likely the same record entered twice.

  The composite key already blocks exact duplicates, so what remains are the
  near-matches it cannot catch: a typo, a dropped accent, `St.` for `Saint`, a
  translator entered as "R. Burton" once and "Richard Burton" the next time.

  Six words carry specific meanings here:

    * **candidate pair** — two publications similar enough to be worth review.
    * **cluster** — a connected component of the candidate graph. If A matches B
      and B matches C, all three form one cluster, because merging them is one
      operation.
    * **distinction** — a stored record that two publications are not the same,
      so the review stops offering them. See `Distinction`.
    * **ruled apart** — the state of a pair that has a distinction.
    * **row** — a publication being imported that is not stored yet. It has no
      id, so `resemblances/1` refers to it by its position in the list it is
      given.
    * **repeat** — a row with the same composite key as an earlier row in the
      same list: the same title, year and original title, and the same names
      in each list, in any order. The database would refuse to store both
      rows, so a repeat is an error. A resemblance is not an error.

  Similarity is trigram distance, the measure the author lookup also uses, over
  the fields a duplicate would agree on. A pair is a candidate when the
  translators are similar, either the titles are or the original books are, and
  the two agree on the year, the countries and the publishers.

  Two publications agree on one of those fields when either of them has no value
  for it. Otherwise they agree on the year when the years are equal, on the
  countries when they share a country, and on the publishers when the
  publishers are similar or one side's contain the other's words, as "Alfred A.
  Knopf" contains "Knopf". So another edition of a book, with its own year,
  country or publisher, is not proposed. A record that leaves those fields
  empty can still be.

  The translators are the required half because this is a database of
  translations: two people translating one book is the subject matter, not an
  error. "Dom Casmurro" translated by Helen Caldwell and by John Gledson share a
  title and an original book and are two distinct publications.

  When one side leaves the year, countries or publishers out, nothing can tell
  two editions of one book from two records of one edition, so the rule proposes
  and a reviewer decides. Distinctions persist that decision, which is what
  makes the queue converge.

  `clusters/0` and `resemblances/1` use the same similarity rule. `clusters/0`
  compares stored records with each other. `resemblances/1` compares rows with
  the stored records and with each other.
  """

  import Ecto.Query

  alias RichardBurton.Country
  alias RichardBurton.FlatPublication
  alias RichardBurton.Repo

  @default_threshold 0.55

  defmodule Distinction do
    @moduledoc """
    One remembered "these two are not the same". Stored for the pair, lower id
    first, so the answer is the same however it is asked.
    """

    use Ecto.Schema
    import Ecto.Changeset

    schema "publication_distinctions" do
      field(:publication_id, :integer)
      field(:other_publication_id, :integer)
      field(:actor, :string)

      timestamps(updated_at: false)
    end

    @doc false
    def changeset(distinction, attrs) do
      distinction
      |> cast(attrs, [:publication_id, :other_publication_id, :actor])
      |> validate_required([:publication_id, :other_publication_id, :actor])
      |> unique_constraint([:publication_id, :other_publication_id],
        name: :publication_distinctions_pair
      )
    end
  end

  @doc """
  How alike two records must be to be worth asking about, between 0 and 1.

  Read at run time from `:duplicate_threshold`, so the sensitivity can be tuned
  against real data — too low floods the reviewer with false clusters, too high
  misses real duplicates — without changing any code.
  """
  def threshold do
    Application.get_env(:richard_burton, :duplicate_threshold, @default_threshold)
  end

  @doc """
  The clusters worth reviewing, likeliest first.

  A cluster is a set of records joined by likeness: if A looks like B and B looks
  like C, all three are one question, because merging them is one act. Pairs
  already ruled apart are not edges, so ruling one out can split a cluster rather
  than merely shrinking it.
  """
  def clusters do
    edges = candidate_pairs()

    edges
    |> connected()
    |> Enum.map(&%{publications: load(&1), score: best_score(&1, edges)})
    |> Enum.sort_by(& &1.score, :desc)
  end

  @doc """
  Record that these publications are not the same record twice, so the reviewer
  is not asked about them again. Every pair among them is ruled apart: the answer
  is about the cluster the reviewer was shown.
  """
  def rule_apart(ids, actor) when is_list(ids) do
    pairs = for a <- ids, b <- ids, a < b, do: {a, b}

    entries =
      Enum.map(pairs, fn {a, b} ->
        %{
          publication_id: a,
          other_publication_id: b,
          actor: actor,
          inserted_at: NaiveDateTime.utc_now(:second)
        }
      end)

    case entries do
      [] ->
        {:error, :not_enough}

      entries ->
        # A pair already ruled apart stays as it was recorded, by whoever said so
        # first.
        {count, _} =
          Repo.insert_all(Distinction, entries,
            on_conflict: :nothing,
            conflict_target: [:publication_id, :other_publication_id]
          )

        {:ok, count}
    end
  end

  @doc """
  Deletes the distinctions among these publications, returning the pair or
  cluster to the review queue.

  Every pair among the ids is deleted, mirroring how `rule_apart/2` records
  them: the decision covered the cluster, so reversing it does too.
  """
  def reconsider(ids) when is_list(ids) do
    {count, _} = Repo.delete_all(among(ids))
    {:ok, count}
  end

  @doc """
  The pairs someone has ruled apart, newest first, with the records themselves.

  A decision that cannot be seen cannot be taken back, and this is what a
  reviewer looks at to find one worth reconsidering.
  """
  def ruled_apart do
    from(d in Distinction, order_by: [desc: d.id])
    |> Repo.all()
    |> Enum.map(
      &%{
        publications: load([&1.publication_id, &1.other_publication_id]),
        actor: &1.actor,
        timestamp: &1.inserted_at
      }
    )
    # A pair is dropped when either record has left the index, by merge or by
    # deletion: there is no longer a duplicate to review.
    |> Enum.filter(&(length(&1.publications) == 2))
  end

  @doc """
  Returns what each row resembles, among the stored records and the other rows
  in the list, and which earlier row it repeats.

  The result has one entry for each row that resembles something or is a
  repeat, in position order. An entry holds `position`, the row's index in
  `rows`; `stored`, the flat publications it resembles; `others`, the positions
  of the other rows it resembles; and `repeats`, the position of the first row
  with the same composite key when the row is a repeat, or nil. A row that
  resembles nothing and is not a repeat has no entry.

  Rows are string-keyed flat publications, the same shape validation takes.
  This function writes nothing. It does not check or record distinctions,
  because a distinction links two stored records and a row is not stored.
  """
  def resemblances([]), do: []

  def resemblances(rows) when is_list(rows) do
    measured = measured(rows)

    {:ok, {stored, among_rows, repeats}} =
      Repo.transaction(fn ->
        put_threshold()

        {
          Repo.all(resembling_stored(measured)),
          Repo.all(resembling_each_other(measured)),
          Repo.all(repeating(measured))
        }
      end)

    gather(stored, among_rows, Map.new(repeats))
  end

  # The fields of a row that the similarity rule reads.
  @measured [
    "title",
    "authors",
    "original_title",
    "original_authors",
    "year",
    "countries",
    "publishers"
  ]

  # Encodes the rows as the JSON array that `rows_to_measure/1` reads: each row's
  # measured fields, plus its `position` in the list. A year that is not a
  # whole number, such as an empty one, is sent as null. A country given by name
  # is sent as its code, as validation stores it.
  defp measured(rows) do
    codes = country_codes(rows)

    rows
    |> Enum.with_index()
    |> Enum.map(fn {row, position} ->
      row
      |> Map.take(@measured)
      |> Map.update("year", nil, &year/1)
      |> Map.update("countries", [], &Enum.map(List.wrap(&1), fn c -> Map.get(codes, c, c) end))
      |> Map.put("position", position)
    end)
    |> Jason.encode!()
  end

  # Maps each country the rows name to its code, or to itself when it names no
  # single country. Each value is looked up once, because a lookup is slow and
  # the rows of an import mostly name the same few countries.
  defp country_codes(rows) do
    rows
    |> Enum.flat_map(&List.wrap(Map.get(&1, "countries")))
    |> Enum.uniq()
    |> Map.new(&{&1, Country.code_for(&1) || &1})
  end

  # Reads a row's year as an integer, or nil when it is not one.
  defp year(year) when is_integer(year), do: year

  defp year(year) when is_binary(year) do
    case Integer.parse(String.trim(year)) do
      {parsed, ""} -> parsed
      _ -> nil
    end
  end

  defp year(_year), do: nil

  # Builds the result of `resemblances/1` from the two query results and the
  # repeats: one entry per row that resembles something or is a repeat, in
  # position order. A pair of resembling rows appears in the `others` of both
  # rows.
  defp gather(stored, among_rows, repeats) do
    resembled = Enum.group_by(stored, & &1.position, & &1.record)
    others = adjacency(among_rows)

    [resembled, others, repeats]
    |> Enum.flat_map(&Map.keys/1)
    |> Enum.uniq()
    |> Enum.sort()
    |> Enum.map(fn position ->
      %{
        position: position,
        stored: Map.get(resembled, position, []),
        others: others |> Map.get(position, []) |> Enum.sort(),
        repeats: Map.get(repeats, position)
      }
    end)
  end

  # Expands to a `fragment` that reads the JSON from `measured/1` as a table
  # with a `position` column and a column for each measured field. The columns
  # have the types of the same columns of `flat_publications`, so `alike/1` and
  # `agree/1` compare a row's fields the same way they compare a stored
  # record's. It is a macro because `fragment` needs its SQL as a literal where
  # the query is built, and two queries use it.
  defmacrop rows_to_measure(measured) do
    quote do
      fragment(
        "(SELECT * FROM jsonb_to_recordset(?::text::jsonb) AS t(position int, title text, authors varchar[], original_title text, original_authors varchar[], year int, countries varchar[], publishers varchar[]))",
        ^unquote(measured)
      )
    end
  end

  # Query for each row and stored record that resemble each other, selecting the
  # row's position and the record, ordered by the record's title. The translator
  # comparison can use the trigram index, so a row is compared only with the
  # records that share a trigram with its translators, not with the whole table.
  defp resembling_stored(measured) do
    from(row in rows_to_measure(measured),
      as: :left,
      join: p in FlatPublication,
      as: :right,
      on: ^worth_asking_about(),
      order_by: [asc: p.title, asc: p.id],
      select: %{position: field(as(:left), :position), record: p}
    )
  end

  # Query for each pair of rows that resemble each other, selecting both
  # positions. The join keeps only pairs where the left position is lower, so
  # each pair appears once. This finds near-duplicates within the list itself,
  # which `resembling_stored/1` cannot find because neither row is stored.
  defp resembling_each_other(measured) do
    from(a in rows_to_measure(measured),
      as: :left,
      join: b in rows_to_measure(measured),
      as: :right,
      on: field(as(:left), :position) < field(as(:right), :position),
      where: ^worth_asking_about(),
      select: %{left: field(as(:left), :position), right: field(as(:right), :position)}
    )
  end

  # Query for each repeat among the rows, selecting its position and the
  # position of the first row with the same composite key. Rows have the same
  # key when their titles, years and original titles are equal and
  # `rb_set_fingerprint` gives each of their lists of names the same
  # fingerprint, which is how the composite keys compare them. A row missing any
  # of those fields repeats nothing.
  defp repeating(measured) do
    first_with_key =
      from(row in rows_to_measure(measured),
        where:
          fragment("coalesce(?, '') <> ''", field(row, :title)) and
            not is_nil(field(row, :year)) and
            fragment("coalesce(?, '') <> ''", field(row, :original_title)) and
            fragment("cardinality(?) > 0", field(row, :countries)) and
            fragment("cardinality(?) > 0", field(row, :publishers)) and
            fragment("cardinality(?) > 0", field(row, :authors)) and
            fragment("cardinality(?) > 0", field(row, :original_authors)),
        windows: [
          same_key: [
            partition_by: [
              field(row, :title),
              field(row, :year),
              field(row, :original_title),
              fragment("rb_set_fingerprint(?::text[])", field(row, :countries)),
              fragment("rb_set_fingerprint(?::text[])", field(row, :publishers)),
              fragment("rb_set_fingerprint(?::text[])", field(row, :authors)),
              fragment("rb_set_fingerprint(?::text[])", field(row, :original_authors))
            ]
          ]
        ],
        select: %{
          position: field(row, :position),
          first: over(min(field(row, :position)), :same_key)
        }
      )

    from(r in subquery(first_with_key),
      where: r.position != r.first,
      select: {r.position, r.first}
    )
  end

  # Query for every distinction among these ids. Both columns are checked
  # against the same list, so the stored order of a pair does not matter.
  defp among(ids) do
    from(d in Distinction,
      where: d.publication_id in ^ids and d.other_publication_id in ^ids
    )
  end

  # Every candidate pair among live publications, excluding pairs already ruled
  # apart.
  defp candidate_pairs do
    {:ok, pairs} =
      Repo.transaction(fn ->
        put_threshold()
        Repo.all(candidates())
      end)

    pairs
  end

  # `%` is equivalent to `similarity(a, b) > threshold` but is indexable, so a
  # record is compared only against those sharing a trigram with it rather than
  # against every other row. It reads the threshold from
  # `pg_trgm.similarity_threshold`, which is why that is set per transaction
  # rather than interpolated into the expression.
  defp put_threshold do
    Repo.query!(
      "SELECT set_config('pg_trgm.similarity_threshold', $1, true)",
      [to_string(threshold())]
    )
  end

  # The candidate-pair query: a self-join over live publications, ordered by id
  # so each unordered pair appears once, with pairs already ruled apart removed
  # by the anti-join.
  defp candidates do
    from(a in FlatPublication,
      as: :left,
      join: b in FlatPublication,
      as: :right,
      on: a.id < b.id,
      where: ^worth_asking_about(),
      left_join: d in Distinction,
      on: d.publication_id == a.id and d.other_publication_id == b.id,
      where: is_nil(d.id),
      # Ranked on the titles: a pair that all but spells the same is likelier to
      # be one record twice than a pair matched through the book behind them.
      select: %{
        left: a.id,
        right: b.id,
        score: fragment("similarity(?, ?)", a.title, b.title)
      }
    )
  end

  # The similarity rule: translators alike, either the title or the original
  # book alike, and agreement on the year, the countries and the publishers.
  defp worth_asking_about do
    dynamic(
      ^alike(:authors) and
        (^alike(:title) or (^alike(:original_title) and ^alike(:original_authors))) and
        ^agree(:year) and ^agree(:countries) and ^agree(:publishers)
    )
  end

  # The `word_similarity` at or above which one side's publishers count as
  # containing the other's words. Containing every word scores 1.0. The
  # threshold is slightly lower so that a word that differs only in its ending
  # still counts: "Penguin Book" scores 0.92 against "Penguin Books".
  @contained 0.9

  # Whether the two sides agree on `field`: either side has no value for it, or
  # the values match. Years must be equal, countries must share one, and
  # publishers must be alike or one must contain the other's words.
  defp agree(:year) do
    dynamic(
      is_nil(field(as(:left), :year)) or is_nil(field(as(:right), :year)) or
        field(as(:left), :year) == field(as(:right), :year)
    )
  end

  defp agree(:countries) do
    dynamic(
      fragment(
        "(coalesce(cardinality(?), 0) = 0 OR coalesce(cardinality(?), 0) = 0 OR ? && ?)",
        field(as(:left), :countries),
        field(as(:right), :countries),
        field(as(:left), :countries),
        field(as(:right), :countries)
      )
    )
  end

  defp agree(:publishers) do
    dynamic(
      fragment(
        "(coalesce(cardinality(?), 0) = 0 OR coalesce(cardinality(?), 0) = 0 OR rb_joined(?) % rb_joined(?) OR greatest(word_similarity(rb_joined(?), rb_joined(?)), word_similarity(rb_joined(?), rb_joined(?))) >= ?)",
        field(as(:left), :publishers),
        field(as(:right), :publishers),
        field(as(:left), :publishers),
        field(as(:right), :publishers),
        field(as(:left), :publishers),
        field(as(:right), :publishers),
        field(as(:right), :publishers),
        field(as(:left), :publishers),
        @contained
      )
    )
  end

  # A name and a book's title are one value; translators and original authors
  # are lists. `rb_joined` reads a list as its values with a space between — the
  # same way the search index reads these columns — and the index on them is
  # written that way too, so the comparison can use it.
  @lists [:authors, :original_authors]

  # Compares one list field of the two sides, `left` and `right`, each read
  # through `rb_joined`.
  defp alike(field) when field in @lists do
    dynamic(
      fragment(
        "rb_joined(?) % rb_joined(?)",
        field(as(:left), ^field),
        field(as(:right), ^field)
      )
    )
  end

  # Compares one scalar field of the two sides, `left` and `right`.
  defp alike(field) do
    dynamic(fragment("? % ?", field(as(:left), ^field), field(as(:right), ^field)))
  end

  # Returns the connected components of the candidate pairs, as sorted id lists.
  defp connected(edges), do: edges |> adjacency() |> components()

  # Builds an undirected adjacency map from pairs of `left` and `right`: each
  # vertex maps to the vertices it is paired with.
  defp adjacency(edges) do
    Enum.reduce(edges, %{}, fn %{left: a, right: b}, adjacency ->
      adjacency
      |> Map.update(a, [b], &[b | &1])
      |> Map.update(b, [a], &[a | &1])
    end)
  end

  # Walks the vertices in id order, flood-filling from each one not already
  # claimed by an earlier component.
  defp components(adjacency) do
    adjacency
    |> Map.keys()
    |> Enum.sort()
    |> Enum.reduce({[], MapSet.new()}, fn id, {found, seen} ->
      if MapSet.member?(seen, id) do
        {found, seen}
      else
        component = reachable([id], adjacency, MapSet.new())
        {[Enum.sort(component) | found], MapSet.union(seen, component)}
      end
    end)
    |> elem(0)
    |> Enum.reverse()
  end

  # Flood fill over the adjacency map. `seen` is both the visited set and the
  # result, so each vertex is expanded once and a cycle terminates.
  defp reachable([], _adjacency, seen), do: seen

  defp reachable([id | rest], adjacency, seen) do
    if MapSet.member?(seen, id) do
      reachable(rest, adjacency, seen)
    else
      reachable(Map.get(adjacency, id, []) ++ rest, adjacency, MapSet.put(seen, id))
    end
  end

  # A cluster's score: the highest similarity among the edges inside it, which
  # is what orders the review queue.
  defp best_score(ids, edges) do
    members = MapSet.new(ids)

    edges
    |> Enum.filter(&(MapSet.member?(members, &1.left) and MapSet.member?(members, &1.right)))
    |> Enum.map(& &1.score)
    |> Enum.max(fn -> 0.0 end)
  end

  # The flat publications for these ids, ordered by title then id so a cluster
  # is presented the same way every time.
  defp load(ids) do
    from(fp in FlatPublication, where: fp.id in ^ids, order_by: [asc: fp.title, asc: fp.id])
    |> Repo.all()
  end
end
