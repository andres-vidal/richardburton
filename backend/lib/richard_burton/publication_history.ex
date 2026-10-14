defmodule RichardBurton.Publication.History do
  @moduledoc """
  The append-only log of changes to publications. Each row records one change
  to one publication: the action, a flat snapshot of the publication after it,
  the actor, and a version that numbers the publication's entries in order.

  The database keeps the log append-only: a trigger rejects every UPDATE and
  DELETE on the table (see the migration `SoftDeletePublications`). Every
  change goes through the `RichardBurton.Publication` functions, or through
  `RichardBurton.Vocabulary.rename/5` for a change of name, and each records
  its entries inside the transaction that makes the change. So a change and its
  entries commit or roll back together.

  Terms used here:

    * **stream** — the entries of one publication, newest first.
    * **head** — the latest entry of a stream that is not a decision. See
      `head/1`.
    * **others** — the other publications an entry is about, each with its
      snapshot when the entry was recorded. The entry's action says how they
      are involved: a merge absorbed them, an un-merge gave them back, or a
      decision is about them. An entry of any other action has none.
    * **absorbed** — the state of a publication held inside another by a
      merge. A `"merged"` entry is on the publication that survived the merge,
      and names the publications it absorbed in its `others`. An `"unmerged"`
      entry names the ones it gave back. See `absorbed/1`.
    * **decision** — a duplicate reviewer's answer about publications that look
      alike, recorded by `RichardBurton.Publication.Duplicates`. A
      `"distinguished"` entry records that the publications are not the same
      record twice, and a `"reconsidered"` entry that the answer was taken
      back. Each publication the decision is about gets an entry, which names
      the other publications in its `others`. A decision changes no field, so
      its entry has no diff. It is not undone from the history, and `head/1`
      and `undoable?/3` skip it, so it does not stop the entries before it from
      being undone.

  A `"renamed"` entry records a change of name made in names management, on
  each publication that credits the name. It is diffed like an update, but it
  is not undone from the publication's history. Renaming the name again takes
  the change back for every publication at once.
  """

  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query

  alias RichardBurton.Publication
  alias RichardBurton.Publication.Codec
  alias RichardBurton.Publication.History
  alias RichardBurton.Repo

  # The actions of the duplicate reviewer's decisions. See the module doc.
  @decisions ["distinguished", "reconsidered"]

  @actions ["created", "updated", "deleted", "restored", "merged", "unmerged", "renamed"] ++
             @decisions

  # The actions as the atoms that `record/4` and `record_all/3` take.
  @action_atoms Enum.map(@actions, &String.to_atom/1)

  # The actor of a change made outside a request, such as by a seed or a mix
  # task.
  @system_actor "system"

  # The snapshot keys that no editor writes: the publication's id, and the
  # fingerprints that older snapshots in the log hold. They are never diffed,
  # and they are dropped before a snapshot is written back to a publication.
  @derived ~w[id countries_fingerprint translated_book_fingerprint publishers_fingerprint]

  # The keys the diff leaves out of `fields`. Sources are diffed as a list of
  # their own, in `sources`.
  @undiffed ["sources" | @derived]

  # The fields that hold a set of names. A snapshot lists each one sorted, and
  # two snapshots are compared on the members of each set.
  @sets ~w[authors original_authors countries publishers]

  schema "publication_history" do
    field(:publication_id, :integer)
    field(:version, :integer)
    field(:action, :string)
    field(:snapshot, :map)
    field(:actor, :string)

    # The other publications this entry is about, as a map from each one's id
    # to its snapshot at the time: the ones a merge absorbed, an un-merge gave
    # back, or a decision is about. Nil on every other entry.
    field(:others, :map)

    # What this entry changed in its publication, against the entry before it
    # in the stream.
    field(:diff, :map, virtual: true)

    # Whether `RichardBurton.Publication.undo/3` can undo this entry now.
    field(:undoable, :boolean, virtual: true)

    timestamps(updated_at: false)
  end

  @doc false
  def changeset(history, attrs) do
    history
    |> cast(attrs, [:publication_id, :version, :action, :snapshot, :actor, :others])
    |> validate_required([:publication_id, :version, :action, :snapshot, :actor])
    |> validate_inclusion(:action, @actions)
    |> unique_constraint([:publication_id, :version])
  end

  @doc "Returns the actor recorded for a change made outside a request."
  def system_actor, do: @system_actor

  @doc """
  Appends the entry that records `action` on `publication`, inside the
  caller's transaction. `others` names the publications a merge absorbed, or
  an un-merge gave back.
  """
  def record(action, publication = %Publication{}, actor, others \\ [])
      when action in @action_atoms do
    append([publication], &entry(action, &1, actor, &2, others))
  end

  @doc """
  Appends an entry that records `action` for each of `publications`, inside
  the caller's transaction. It reads the publications' current versions with
  one query and inserts the entries with one insert per chunk, so the number of
  queries does not depend on the number of publications.
  """
  def record_all(action, publications, actor) when action in @action_atoms do
    append(publications, &entry(action, &1, actor, &2))
  end

  @doc """
  Appends a decision's entry for each of `publications`, inside the caller's
  transaction, as `record_all/3` does. `action` is `:distinguished` or
  `:reconsidered`, and each entry names the other publications in `others`.
  """
  def record_decision(action, publications, actor)
      when action in [:distinguished, :reconsidered] do
    append(publications, fn publication, version ->
      others = Enum.reject(publications, &(&1.id == publication.id))
      entry(action, publication, actor, version, others)
    end)
  end

  # Inserts the entry `build` returns for each of `publications`, given the
  # publication and its next version. It reads the current versions with one
  # query and inserts the entries with one insert per chunk.
  #
  # Two changes to the same publication wait for each other on its row lock,
  # so the versions read here do not change before the insert. The unique
  # index on `(publication_id, version)` makes any other race an error rather
  # than two entries with one version.
  defp append([], _build), do: []

  defp append(publications, build) do
    ids = Enum.map(publications, & &1.id)

    versions =
      from(h in History,
        where: h.publication_id in ^ids,
        group_by: h.publication_id,
        select: {h.publication_id, max(h.version)}
      )
      |> Repo.all()
      |> Map.new()

    Repo.insert_in_chunks(
      History,
      Enum.map(publications, &build.(&1, Map.get(versions, &1.id, 0) + 1))
    )
  end

  @doc """
  Appends a `"created"` entry for each of `publications`, with one insert per
  chunk, inside the caller's transaction. The publications must be ones the
  transaction inserted, so each entry is its publication's first version.
  """
  def record_created(publications, actor) do
    Repo.insert_in_chunks(History, Enum.map(publications, &entry(:created, &1, actor, 1)))
  end

  # Returns the fields of the entry that records `action` on `publication` as
  # its `version`, with `others` as the other publications it is about.
  defp entry(action, publication, actor, version, others \\ []) do
    %{
      publication_id: publication.id,
      version: version,
      action: to_string(action),
      snapshot: snapshot(publication),
      actor: actor,
      others: snapshots_by_id(others)
    }
  end

  # Returns a map from the id of each of `publications`, as a string, to its
  # snapshot, or nil when there are none.
  defp snapshots_by_id([]), do: nil

  defp snapshots_by_id(publications),
    do: Map.new(publications, &{to_string(&1.id), snapshot(&1)})

  @doc "Returns the ids of the other publications an entry is about."
  def other_ids(%History{others: nil}), do: []

  def other_ids(%History{others: others}),
    do: others |> Map.keys() |> Enum.map(&String.to_integer/1)

  @doc """
  Returns the snapshots of the other publications an entry is about, ordered
  by id. Each snapshot keeps its `"id"` and leaves out the fingerprints.
  """
  def other_records(%History{others: nil}), do: []

  def other_records(%History{others: others}) do
    others
    |> Map.values()
    |> Enum.map(&Map.drop(&1, @derived -- ["id"]))
    |> Enum.sort_by(& &1["id"])
  end

  @doc "Returns the stream of one publication, annotated by `annotate/2`."
  def of(publication_id) do
    from(h in History, where: h.publication_id == ^publication_id, order_by: [desc: h.version])
    |> Repo.all()
    |> annotate(absorbed([publication_id]))
  end

  @doc """
  Returns every entry in the log, newest first, annotated by `annotate/2`.

  It reads the log with one query. The publications that are absorbed are
  found from the merge and un-merge entries among the ones it read.
  """
  def all do
    entries = from(h in History, order_by: [desc: h.id]) |> Repo.all()

    annotate(entries, held(entries))
  end

  @doc """
  Sets the `diff` and `undoable` fields of each entry, and returns the entries
  in the order given. `entries` come newest first within each publication's
  stream, and may hold the streams of several publications, interleaved.
  `absorbed` holds the ids of the publications that are absorbed.

  An update, a rename, a merge and an un-merge get a diff, which compares the
  entry's snapshot with the snapshot of the next older entry in its own
  stream. It holds `fields`, each changed field with its value `from` before
  and `to` after, and `sources`, the sources added and removed, or nil when
  the sources did not change. Every other entry, and the oldest entry of a
  stream, gets a nil diff.

  An entry is undoable when `undoable?/3` says so, and never while its
  publication is absorbed, because only undoing the merge gives that
  publication back.

  ## Examples

  An update and the import before it, newest first:

      iex> alias RichardBurton.Publication.History
      iex> [update, import] =
      ...>   History.annotate(
      ...>     [
      ...>       %History{publication_id: 1, version: 2, action: "updated", snapshot: %{"title" => "New"}},
      ...>       %History{publication_id: 1, version: 1, action: "created", snapshot: %{"title" => "Old"}}
      ...>     ],
      ...>     MapSet.new()
      ...>   )
      iex> update.diff.fields
      %{"title" => %{from: "Old", to: "New"}}
      iex> {update.undoable, import.diff, import.undoable}
      {true, nil, false}

  The update is the head, so it is undoable. The import has no older entry to
  compare with, and it is not undoable once a later entry exists.
  """
  def annotate(entries, absorbed) do
    streams = Enum.group_by(entries, & &1.publication_id)

    previous =
      Enum.flat_map(streams, fn {_id, stream} ->
        stream
        |> Enum.zip(Enum.drop(stream, 1))
        |> Enum.map(fn {entry, previous} -> {{entry.publication_id, entry.version}, previous} end)
      end)
      |> Map.new()

    heads = Map.new(streams, fn {id, stream} -> {id, head(stream)} end)

    Enum.map(entries, fn entry ->
      previous = Map.get(previous, {entry.publication_id, entry.version})
      head = Map.fetch!(heads, entry.publication_id)

      undoable =
        not MapSet.member?(absorbed, entry.publication_id) and
          undoable?(entry, previous, head)

      %{entry | diff: diff(previous, entry), undoable: undoable}
    end)
  end

  @doc """
  Returns the latest entry of a stream that is not a decision, or the latest
  entry when every entry is one. A decision changes no field, so the entries
  before it are undone as if it were not there.
  """
  def head(stream), do: Enum.find(stream, &(&1.action not in @decisions)) || hd(stream)

  @doc """
  Returns the ids among `ids` of the publications that are absorbed now.

  A publication is absorbed when the latest `"merged"` or `"unmerged"` entry
  that names it in `others` is a `"merged"` one. That entry is in the stream
  of the publication that survived the merge, not in the absorbed
  publication's own stream. The query reads only the ids that `others` holds,
  and at most one entry for each of `ids`.
  """
  @spec absorbed([pos_integer()]) :: MapSet.t(pos_integer())
  def absorbed(ids) do
    keys = Enum.map(ids, &to_string/1)

    latest =
      from(h in History,
        inner_lateral_join: k in fragment("SELECT jsonb_object_keys(?) AS id", h.others),
        on: true,
        where: h.action in ["merged", "unmerged"],
        where: k.id in type(^keys, {:array, :string}),
        distinct: k.id,
        order_by: [desc: h.id],
        select: {k.id, h.action}
      )
      |> Repo.all()

    for {id, "merged"} <- latest, into: MapSet.new(), do: String.to_integer(id)
  end

  # Returns the ids of the publications that are absorbed after `entries`,
  # which hold every merge and un-merge entry in the log, newest first. It
  # applies the rule `absorbed/1` reads from the database, to entries that are
  # already loaded.
  defp held(entries) do
    entries
    |> Enum.reverse()
    |> Enum.reduce(MapSet.new(), fn
      entry = %History{action: "merged"}, held ->
        MapSet.union(held, MapSet.new(other_ids(entry)))

      entry = %History{action: "unmerged"}, held ->
        MapSet.difference(held, MapSet.new(other_ids(entry)))

      _entry, held ->
        held
    end)
  end

  @doc """
  Returns whether undoing `entry` would leave its publication as if the entry
  had never happened, with every later change kept. `previous` is the entry
  before it in its stream, or nil, and `head` is the stream's head (see
  `head/1`).

    * The head is undoable. The action that undoes it applies directly: a
      restore undoes a delete, a delete undoes an import or a restore, and an
      update is reverted.
    * An older update is undoable while the publication is not deleted and
      every field the update changed still holds the value it set. Undoing it
      then changes only those fields, and keeps later changes to the others.
    * An older entry of any other action is not undoable. A later restore
      already undid an older delete, and undoing an older import or restore
      would discard the changes that followed it. A merge or an un-merge
      changes several publications at once, and the changes after an older
      one were made to the merged publication.
    * A rename is not undoable. It changed a name for every publication that
      credits it, and renaming the name again takes it back.
    * A decision is not undoable. It is taken back in the duplicate review.
  """
  def undoable?(entry, previous, head) do
    cond do
      entry.action in ["renamed" | @decisions] -> false
      entry.version == head.version -> true
      entry.action != "updated" -> false
      head.action == "deleted" -> false
      is_nil(previous) -> false
      true -> untouched_since?(previous.snapshot, entry.snapshot, head.snapshot)
    end
  end

  # Returns whether every field that changed from `previous` to `current` still
  # holds its value from `current` in `head`.
  defp untouched_since?(previous, current, head) do
    previous
    |> changed_keys(current)
    |> Enum.all?(&(not field_changed?(current, head, &1)))
  end

  @doc """
  Returns the snapshot that undoing the update `entry` writes: the head's
  snapshot, with the fields the update changed put back to their values in
  `previous`, and without the keys no editor writes. For the head itself, that
  is the snapshot of `previous`. For an older update, the later changes to
  other fields are kept.
  """
  def reverted_snapshot(entry, previous, head) do
    previous.snapshot
    |> changed_keys(entry.snapshot)
    |> Enum.reduce(head.snapshot, &Map.put(&2, &1, previous.snapshot[&1]))
    |> Map.drop(@derived)
  end

  # Returns the keys whose values differ between two snapshots, leaving out the
  # keys no editor writes.
  defp changed_keys(previous, current) do
    (Map.keys(previous) ++ Map.keys(current))
    |> Enum.uniq()
    |> Enum.reject(&(&1 in @derived))
    |> Enum.filter(&field_changed?(previous, current, &1))
  end

  # Returns whether `field` differs between two snapshots. Sources are compared
  # as lists, with a missing list equal to an empty one. The sets of names are
  # compared by their members, so a snapshot that lists them in another order
  # holds the same set.
  defp field_changed?(a, b, "sources"), do: (a["sources"] || []) != (b["sources"] || [])
  defp field_changed?(a, b, field) when field in @sets, do: sorted(a[field]) != sorted(b[field])
  defp field_changed?(a, b, field), do: a[field] != b[field]

  # Returns what `entry` changed against `previous`, or nil. An update, a
  # rename, a merge and an un-merge change the fields of their publication, and
  # their diff is `compare/2`'s. Every other entry, and an entry with no
  # previous one, has no diff.
  defp diff(nil, _entry), do: nil

  defp diff(previous, entry = %History{action: action})
       when action in ["updated", "merged", "unmerged", "renamed"],
       do: compare(previous, entry)

  defp diff(_previous, _entry), do: nil

  # Returns the difference between two entries' snapshots as raw values: under
  # `fields`, each changed field with its value `from` before and `to` after,
  # and under `sources`, what `source_change/2` returns.
  defp compare(%History{snapshot: previous}, %History{snapshot: current}) do
    fields =
      (Map.keys(previous) ++ Map.keys(current))
      |> Enum.uniq()
      |> Enum.reject(&(&1 in @undiffed))
      |> Enum.filter(&field_changed?(previous, current, &1))
      |> Map.new(&{&1, %{from: previous[&1], to: current[&1]}})

    %{fields: fields, sources: source_change(previous["sources"], current["sources"])}
  end

  # Returns the sources `current` added and removed against `previous`, or
  # `reordered: true` when it holds the same sources in another order, or nil
  # when the sources did not change. A missing list is an empty one. The
  # difference counts repeats, so a source listed twice and removed once is
  # removed once.
  defp source_change(previous, current) do
    previous = previous || []
    current = current || []
    added = current -- previous
    removed = previous -- current

    cond do
      added != [] or removed != [] -> %{added: added, removed: removed, reordered: false}
      previous != current -> %{added: [], removed: [], reordered: true}
      true -> nil
    end
  end

  @doc """
  Returns the snapshot a history entry stores for `publication`: the flat
  fields `RichardBurton.Publication.Codec.flatten/1` returns for it, with
  atom keys and each set of names sorted. The publication's associations must
  be loaded.

  Two snapshots are equal when the publication holds the same values, which a
  changeset cannot tell, because it replaces the sources on every save.

  ## Examples

      iex> alias RichardBurton.{Author, Country, OriginalBook, Publication, Publisher, TranslatedBook}
      iex> publication = %Publication{
      ...>   title: "Dom Casmurro",
      ...>   year: 1953,
      ...>   countries: [%Country{code: "US"}],
      ...>   publishers: [%Publisher{name: "Noonday Press"}],
      ...>   sources: [],
      ...>   translated_book: %TranslatedBook{
      ...>     authors: [%Author{name: "Helen Caldwell"}],
      ...>     original_book: %OriginalBook{
      ...>       title: "Dom Casmurro",
      ...>       authors: [%Author{name: "Machado de Assis"}]
      ...>     }
      ...>   }
      ...> }
      iex> snapshot = Publication.History.snapshot(publication)
      iex> {snapshot[:title], snapshot[:authors], snapshot[:countries]}
      {"Dom Casmurro", ["Helen Caldwell"], ["US"]}
  """
  def snapshot(publication = %Publication{}) do
    publication
    |> Codec.flatten()
    |> Map.from_struct()
    |> Map.delete(:__meta__)
    |> Map.new(fn {field, value} ->
      {field, if(to_string(field) in @sets, do: sorted(value), else: value)}
    end)
  end

  # Returns `names` sorted, or nil when there are none.
  defp sorted(names) when is_list(names), do: Enum.sort(names)
  defp sorted(nil), do: nil
end
