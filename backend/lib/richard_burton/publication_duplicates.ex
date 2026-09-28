defmodule RichardBurton.Publication.Duplicates do
  @moduledoc """
  Finds publications that are likely the same record entered twice.

  The composite key already blocks exact duplicates, so what remains are the
  near-matches it cannot catch: a typo, a dropped accent, `St.` for `Saint`, a
  translator entered as "R. Burton" once and "Richard Burton" the next time.

  Five words carry specific meanings here:

    * **candidate pair** — two publications similar enough to be worth review.
    * **cluster** — a connected component of the candidate graph. If A matches B
      and B matches C, all three form one cluster, because merging them is one
      operation.
    * **distinction** — a stored record that two publications are not the same,
      so the review stops offering them. See `Distinction`.
    * **ruled apart** — the state of a pair that has a distinction.
    * **row** — a publication on its way in, not written yet. It has no id, so it
      is named by its position in the list it arrived in. See `resemblances/1`.

  Similarity is trigram distance, the measure the author lookup also uses, over
  the fields a duplicate would agree on. A pair is a candidate when the
  translators are similar and either the titles are, or the original books are.

  The translators are the required half because this is a database of
  translations: two people translating one book is the subject matter, not an
  error. "Dom Casmurro" translated by Helen Caldwell and by John Gledson share a
  title and an original book and are two distinct publications.

  Similarity cannot distinguish two editions of one book from two records of one
  edition, so it proposes and a reviewer decides. Distinctions persist that
  decision, which is what makes the queue converge.

  The same rule answers two questions. `clusters/0` asks it of the stored
  records, and `resemblances/1` asks it of rows on their way in, against the
  stored records and against each other.
  """

  import Ecto.Query

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
  What each of these rows looks like: the stored records it resembles, and the
  other rows in the list it resembles.

  A row is a publication nobody has written yet, so it has no id and no place in
  the candidate-pair query. Its position in the list is what names it, and the
  answer carries one entry per row that resembles something.

  Rows are string-keyed flat publications, the shape validation takes. Nothing
  is remembered about them: a distinction is about two stored records, and a row
  is not one yet.
  """
  def resemblances([]), do: []

  def resemblances(rows) when is_list(rows) do
    columns = columns(rows)

    {:ok, {stored, among_rows}} =
      Repo.transaction(fn ->
        put_threshold()
        {Repo.all(resembling_stored(columns)), Repo.all(resembling_each_other(columns))}
      end)

    gather(stored, among_rows)
  end

  # The rows as the five parallel arrays the queries unnest. List fields are
  # joined here the way `rb_joined` joins a stored one, so both sides of the
  # comparison are spelled the same.
  defp columns(rows) do
    %{
      positions: Enum.to_list(0..(length(rows) - 1)//1),
      titles: Enum.map(rows, &text(&1, "title")),
      authors: Enum.map(rows, &joined(&1, "authors")),
      original_titles: Enum.map(rows, &text(&1, "original_title")),
      original_authors: Enum.map(rows, &joined(&1, "original_authors"))
    }
  end

  defp text(row, key), do: row |> Map.get(key) |> to_string()

  defp joined(row, key), do: row |> Map.get(key, []) |> List.wrap() |> Enum.join(" ")

  # One entry per row with something to report, in position order. An edge
  # between two rows is reported on both, since each row is asked about in turn.
  defp gather(stored, among_rows) do
    records = stored |> Enum.map(& &1.id) |> Enum.uniq() |> load() |> Map.new(&{&1.id, &1})
    resembled = Enum.group_by(stored, & &1.position, &Map.fetch!(records, &1.id))

    others =
      Enum.reduce(among_rows, %{}, fn %{left: a, right: b}, acc ->
        acc |> Map.update(a, [b], &[b | &1]) |> Map.update(b, [a], &[a | &1])
      end)

    [resembled, others]
    |> Enum.flat_map(&Map.keys/1)
    |> Enum.uniq()
    |> Enum.sort()
    |> Enum.map(fn position ->
      %{
        position: position,
        stored: Map.get(resembled, position, []),
        others: others |> Map.get(position, []) |> Enum.sort()
      }
    end)
  end

  # The rows to measure, as a table of five columns. `fragment` takes its SQL
  # written out where the query is built, so this hands the same spelling to
  # both queries that read these rows — the column names it declares are the
  # ones the comparison reads back.
  defmacrop rows_to_measure(columns) do
    quote do
      fragment(
        "(SELECT * FROM unnest(?::int[], ?::text[], ?::text[], ?::text[], ?::text[]) AS t(position, title, authors, original_title, original_authors))",
        ^unquote(columns).positions,
        ^unquote(columns).titles,
        ^unquote(columns).authors,
        ^unquote(columns).original_titles,
        ^unquote(columns).original_authors
      )
    end
  end

  # Every row paired with the stored records it resembles. The translator
  # comparison is the indexed one, so a row is measured against the records
  # sharing a trigram with its translators rather than against the whole table.
  defp resembling_stored(columns) do
    from(row in rows_to_measure(columns),
      as: :left,
      join: p in FlatPublication,
      as: :right,
      on: ^worth_asking_about(&against_stored/1),
      select: %{position: field(as(:left), :position), id: field(as(:right), :id)}
    )
  end

  # Every pair of rows that resemble each other, ordered by position so each
  # unordered pair appears once. A CSV can hold its own near-duplicates, and
  # neither of them is in the database to be found by the query above.
  defp resembling_each_other(columns) do
    from(a in rows_to_measure(columns),
      as: :left,
      join: b in rows_to_measure(columns),
      as: :right,
      on: field(as(:left), :position) < field(as(:right), :position),
      where: ^worth_asking_about(&between_rows/1),
      select: %{left: field(as(:left), :position), right: field(as(:right), :position)}
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
      where: ^worth_asking_about(&between_stored/1),
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

  # The similarity rule: translators alike, and then either the title or the
  # original book. `alike` compares one field across the two sides, and differs
  # by what those sides are — two stored rows, a row being imported against a
  # stored one, or two rows being imported.
  defp worth_asking_about(alike) do
    dynamic(
      ^alike.(:authors) and
        (^alike.(:title) or (^alike.(:original_title) and ^alike.(:original_authors)))
    )
  end

  # A name and a book's title are one value; translators and original authors
  # are lists. `rb_joined` reads a list as its values with a space between — the
  # same way the search index reads these columns — and the index on them is
  # written that way too, so the comparison can use it.
  @lists [:authors, :original_authors]

  # Both sides are stored columns.
  defp between_stored(field) when field in @lists do
    dynamic(
      fragment(
        "rb_joined(?) % rb_joined(?)",
        field(as(:left), ^field),
        field(as(:right), ^field)
      )
    )
  end

  defp between_stored(field) do
    dynamic(fragment("? % ?", field(as(:left), ^field), field(as(:right), ^field)))
  end

  # A row being imported on the left, a stored column on the right. The row
  # arrives with its lists already joined, so only the stored side is read
  # through `rb_joined`.
  defp against_stored(field) when field in @lists do
    dynamic(fragment("? % rb_joined(?)", field(as(:left), ^field), field(as(:right), ^field)))
  end

  defp against_stored(field) do
    dynamic(fragment("? % ?", field(as(:left), ^field), field(as(:right), ^field)))
  end

  # Both sides are rows being imported, so both arrive already joined.
  defp between_rows(field) do
    dynamic(fragment("? % ?", field(as(:left), ^field), field(as(:right), ^field)))
  end

  # Builds an undirected adjacency map from the candidate pairs and returns its
  # connected components as sorted id lists.
  defp connected(edges) do
    edges
    |> Enum.reduce(%{}, fn %{left: a, right: b}, adjacency ->
      adjacency
      |> Map.update(a, [b], &[b | &1])
      |> Map.update(b, [a], &[a | &1])
    end)
    |> components()
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
