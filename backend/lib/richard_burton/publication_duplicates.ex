defmodule RichardBurton.Publication.Duplicates do
  @moduledoc """
  The publications that look like the same record entered twice.

  The composite key blocks *exact* duplicates, so what is left are the ones it
  cannot see: a typo, an accent dropped, `St.` for `Saint`, a translator entered
  as "R. Burton" once and "Richard Burton" the next time. These read as distinct
  records, fragment the database and mislead every count taken from it.

  Likeness is trigram similarity — the same measure the author lookup uses — over
  the fields a duplicate would agree on. Two records are candidates when their
  *translators* are alike and either their titles are alike, or the original
  books they render are.

  The translators are what carries the question, because this is a database of
  translations: two people rendering one book is the subject matter, not a
  mistake. "Dom Casmurro" by Helen Caldwell and "Dom Casmurro" by John Gledson
  agree on title and original book and are still two publications. The same
  translator's work appearing twice is the thing worth asking about.

  Similarity cannot tell two editions of one book from two records of one
  edition, and it is not meant to: it proposes, a person decides. What that
  person rules apart is remembered (see `Distinction`), so the question is asked
  once.
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
  Take back a decision to tell records apart, so the review asks about them
  again.

  Every pair among the ids is forgotten, matching how `rule_apart/2` records
  them: the answer was about the cluster, so taking it back is too.
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
    # A pair whose records are no longer both in the index — merged away, or
    # deleted — has nothing left to ask about.
    |> Enum.filter(&(length(&1.publications) == 2))
  end

  # Every distinction among these records, whichever way round it was stored.
  defp among(ids) do
    from(d in Distinction,
      where: d.publication_id in ^ids and d.other_publication_id in ^ids
    )
  end

  # Every pair of live publications alike enough to ask about, minus the pairs
  # already ruled apart.
  defp candidate_pairs do
    {:ok, pairs} =
      Repo.transaction(fn ->
        put_threshold()
        Repo.all(candidates())
      end)

    pairs
  end

  # `%` asks exactly what `similarity(a, b) > threshold` asks, but it is the
  # question the trigram index can answer, so a record is compared against the
  # handful that share a trigram with it rather than against every other. It
  # takes the bar from the session, which is why the threshold is set here
  # instead of being pinned into the expression.
  defp put_threshold do
    Repo.query!(
      "SELECT set_config('pg_trgm.similarity_threshold', $1, true)",
      [to_string(threshold())]
    )
  end

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

  # Translators alike, and then either the title or the book behind it.
  defp worth_asking_about do
    dynamic(
      ^alike(:authors) and
        (^alike(:title) or (^alike(:original_title) and ^alike(:original_authors)))
    )
  end

  # A name and a book's title are one value; translators and original authors
  # are lists. `rb_words` reads a list as its values with a space between — the
  # same way the search index reads these columns — and the index on them is
  # written that way too, so the comparison can use it.
  @lists [:authors, :original_authors]

  defp alike(field) when field in @lists do
    dynamic(
      fragment(
        "rb_words(?) % rb_words(?)",
        field(as(:left), ^field),
        field(as(:right), ^field)
      )
    )
  end

  defp alike(field) do
    dynamic(fragment("? % ?", field(as(:left), ^field), field(as(:right), ^field)))
  end

  # The connected components of the candidate graph, as sorted id lists.
  defp connected(edges) do
    edges
    |> Enum.reduce(%{}, fn %{left: a, right: b}, adjacency ->
      adjacency
      |> Map.update(a, [b], &[b | &1])
      |> Map.update(b, [a], &[a | &1])
    end)
    |> components()
  end

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

  defp reachable([], _adjacency, seen), do: seen

  defp reachable([id | rest], adjacency, seen) do
    if MapSet.member?(seen, id) do
      reachable(rest, adjacency, seen)
    else
      reachable(Map.get(adjacency, id, []) ++ rest, adjacency, MapSet.put(seen, id))
    end
  end

  # How alike the closest two records in a cluster are — what ranks it.
  defp best_score(ids, edges) do
    members = MapSet.new(ids)

    edges
    |> Enum.filter(&(MapSet.member?(members, &1.left) and MapSet.member?(members, &1.right)))
    |> Enum.map(& &1.score)
    |> Enum.max(fn -> 0.0 end)
  end

  defp load(ids) do
    from(fp in FlatPublication, where: fp.id in ^ids, order_by: [asc: fp.title, asc: fp.id])
    |> Repo.all()
  end
end
