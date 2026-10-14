defmodule RichardBurton.Publication.History do
  @moduledoc """
  Append-only log of publication mutations: one immutable row per change, with
  the action, a flattened snapshot of the record after it, the acting user, and
  a per-publication version so each record's history reads as an ordered
  stream.

  Immutability is enforced by the database — a guard trigger rejects UPDATE and
  DELETE on the table (see the soft-delete migration) — and completeness by
  chokepoint: every mutation flows through the `Publication` context functions,
  or through `RichardBurton.Vocabulary.rename/5` for a change of name, and each
  records its entries inside the mutating transaction, so a change and its
  history rows commit or roll back together.

  A `"renamed"` entry records a change of name made in names management, on
  each publication that credits the name. It is diffed like an update, but it
  cannot be undone from the publication's history: renaming the name again
  takes it back for every publication at once.

  A *decision* is a duplicate reviewer's answer about publications that look
  alike, recorded by `RichardBurton.Publication.Duplicates`. A
  `"distinguished"` entry records that the publications are not the same
  record twice, and a `"reconsidered"` entry that the answer was taken back.
  Each publication the decision is about gets an entry, which names the others
  in `related`. A decision changes no field, so its entry has no diff. It is
  not undone from the history, and it does not stand in the way of undoing the
  entries before it: `head/1` and `undoable?/3` skip decisions.
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

  # Mutations outside a request (seeds, mix tasks) are attributed to "system".
  @system_actor "system"

  # Snapshot keys the server owns rather than an editor: the surrogate id, and
  # the fingerprints that snapshots already in the log carry. Never diffed, and
  # stripped before a snapshot is fed back through the write path.
  @derived ~w[id countries_fingerprint translated_book_fingerprint publishers_fingerprint]

  # Sources are compared as a list rather than as a value, so they are
  # handled apart from the scalar fields.
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

    # The publications this entry took in, or gave back: each one's id against
    # the state it was in. A merge and an un-merge change several records at
    # once, and this is what makes them one entry rather than several — the
    # record that survives holds the entry, and names the ones that did not.
    field(:absorbed, :map)

    # The other publications a decision is about: each one's id against the
    # state it was in when the decision was made. Nil on every other entry.
    field(:related, :map)

    # What this version changed relative to the previous one.
    field(:diff, :map, virtual: true)
    # Whether this version can still be undone
    field(:undoable, :boolean, virtual: true)

    timestamps(updated_at: false)
  end

  @doc false
  def changeset(history, attrs) do
    history
    |> cast(attrs, [:publication_id, :version, :action, :snapshot, :actor, :absorbed, :related])
    |> validate_required([:publication_id, :version, :action, :snapshot, :actor])
    |> validate_inclusion(:action, @actions)
    |> unique_constraint([:publication_id, :version])
  end

  @doc "Actor attributed to mutations that happen outside a request."
  def system_actor, do: @system_actor

  @doc """
  Append one history row for a mutation, inside the caller's transaction.

  Concurrent mutations of the same publication serialize on its row lock, so
  the max-version read is stable; the unique index on (publication_id, version)
  turns any residual race into a loud error instead of silent corruption.
  """
  def record(action, publication = %Publication{}, actor, absorbed \\ [])
      when action in @action_atoms do
    %History{}
    |> changeset(
      entry(action, publication, actor, next_version(publication.id), absorbed: absorbed)
    )
    |> Repo.insert!()
  end

  @doc """
  Appends a history row that records `action` for each of `publications`,
  inside the caller's transaction. It reads the publications' current versions
  with one query and inserts the rows with one insert per chunk, so recording
  a change that reaches many publications takes a fixed number of queries.
  """
  def record_all(action, publications, actor) when action in @action_atoms do
    append(publications, &entry(action, &1, actor, &2))
  end

  @doc """
  Appends a decision's row for each of `publications`, inside the caller's
  transaction, as `record_all/3` does. `action` is `:distinguished` or
  `:reconsidered`, and each row names the other publications in `related`.
  """
  def record_decision(action, publications, actor)
      when action in [:distinguished, :reconsidered] do
    append(publications, fn publication, version ->
      others = Enum.reject(publications, &(&1.id == publication.id))
      entry(action, publication, actor, version, related: others)
    end)
  end

  # Inserts the row `build` returns for each of `publications`, given the
  # publication and its next version. It reads the current versions with one
  # query and inserts the rows with one insert per chunk.
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
  Appends a `created` history row for each of `publications`, with one insert,
  inside the caller's transaction. The publications must be ones the
  transaction inserted, so each row is its publication's first version.
  """
  def record_created(publications, actor) do
    Repo.insert_in_chunks(History, Enum.map(publications, &entry(:created, &1, actor, 1)))
  end

  # Returns the fields of the history row that records `action` on
  # `publication` as its `version`. `others` may name the publications the
  # entry `absorbed`, or the ones it is `related` to.
  defp entry(action, publication, actor, version, others \\ []) do
    %{
      publication_id: publication.id,
      version: version,
      action: to_string(action),
      snapshot: snapshot(publication),
      actor: actor,
      absorbed: snapshots_by_id(Keyword.get(others, :absorbed, [])),
      related: snapshots_by_id(Keyword.get(others, :related, []))
    }
  end

  # The other publications an entry names, against the state they were in.
  # Keyed by id, since that is what putting one back needs to name. Nil when
  # there are none.
  defp snapshots_by_id([]), do: nil

  defp snapshots_by_id(publications),
    do: Map.new(publications, &{to_string(&1.id), snapshot(&1)})

  @doc "The ids of the publications an entry took in, or gave back."
  def absorbed_ids(%History{absorbed: nil}), do: []

  def absorbed_ids(%History{absorbed: absorbed}),
    do: absorbed |> Map.keys() |> Enum.map(&String.to_integer/1)

  @doc """
  The publications an entry took in, or gave back, ordered by id.

  Each one carries its own id and none of the fingerprints: those are the
  server's bookkeeping, not part of the record being shown.
  """
  def absorbed_records(%History{absorbed: absorbed}), do: records(absorbed)

  @doc """
  The other publications a decision is about, ordered by id, in the same form
  as `absorbed_records/1`.
  """
  def related_records(%History{related: related}), do: records(related)

  # Returns the snapshots of a map of them by id, ordered by id, each with its
  # own id and none of the fingerprints, which are the server's bookkeeping.
  defp records(nil), do: []

  defp records(by_id) do
    by_id
    |> Map.values()
    |> Enum.map(&Map.drop(&1, @derived -- ["id"]))
    |> Enum.sort_by(& &1["id"])
  end

  @doc "The ordered history of one publication, newest first, each entry diffed."
  def of(publication_id) do
    from(h in History, where: h.publication_id == ^publication_id, order_by: [desc: h.version])
    |> Repo.all()
    |> annotate()
  end

  @doc "Every recorded mutation across the database, newest first, each diffed."
  def all do
    from(h in History, order_by: [desc: h.id]) |> Repo.all() |> annotate()
  end

  @doc """
  Populate each entry's derived fields: what it changed relative to the previous
  version of *its own* record, and whether it can still be undone.

  Entries come newest first, so a version's predecessor is the next element of
  its stream and the head is the first. Grouping by publication is what lets one
  pass serve both the per-record log and the database-wide feed, where streams
  interleave and the row above an entry usually belongs to a different
  publication. Pairing by position within the stream, rather than looking up
  `version - 1`, also holds if the version sequence ever has a gap.

  Both answers need the whole stream, which is why they are computed here rather
  than asked of one entry at a time.

  ## Examples

  An update over its import — newest first, as the queries return them:

      iex> alias RichardBurton.Publication.History
      iex> [update, import] =
      ...>   History.annotate([
      ...>     %History{publication_id: 1, version: 2, action: "updated", snapshot: %{"title" => "New"}},
      ...>     %History{publication_id: 1, version: 1, action: "created", snapshot: %{"title" => "Old"}}
      ...>   ])
      iex> update.diff.fields
      %{"title" => %{from: "Old", to: "New"}}
      iex> {update.undoable, import.diff, import.undoable}
      {true, nil, false}

  The head is always undoable; the import has nothing before it to diff against,
  and undoing it is not this entry's to offer once a later version exists.
  """
  def annotate(entries) do
    streams = Enum.group_by(entries, & &1.publication_id)

    previous =
      Enum.flat_map(streams, fn {_id, stream} ->
        stream
        |> Enum.zip(Enum.drop(stream, 1))
        |> Enum.map(fn {entry, previous} -> {{entry.publication_id, entry.version}, previous} end)
      end)
      |> Map.new()

    heads = Map.new(streams, fn {id, stream} -> {id, head(stream)} end)
    absorbed = absorbed()

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
  Returns the latest entry of a publication's stream, given newest first, that
  is not a decision. A decision changes no field, so the entries before it are
  undone as if it were not there.
  """
  def head(stream), do: Enum.find(stream, &(&1.action not in @decisions)) || hd(stream)

  @doc """
  The publications that are inside another record right now.

  A merged record's own history is still here, but nothing in it can be undone
  while it is absorbed — it is the merge that holds it, and the merge that gives
  it back. The answer is the whole log's, not one stream's: the entry that holds
  a record sits on the winner, so asking a loser's own history would never find
  it.

  Only the ids are read back: an entry's `absorbed` map carries a whole snapshot
  per record, and none of it is needed to answer which ones are held.
  """
  def absorbed do
    from(h in History,
      where: h.action in ["merged", "unmerged"],
      order_by: [asc: h.id],
      select:
        {h.action,
         fragment("ARRAY(SELECT jsonb_object_keys(coalesce(?, '{}'::jsonb)))", h.absorbed)}
    )
    |> Repo.all()
    |> Enum.reduce(MapSet.new(), fn {action, ids}, absorbed ->
      ids = MapSet.new(ids, &String.to_integer/1)

      case action do
        "merged" -> MapSet.union(absorbed, ids)
        "unmerged" -> MapSet.difference(absorbed, ids)
      end
    end)
  end

  @doc """
  Whether undoing this entry would yield "as if it had never happened, with
  everything after it preserved":

    - a record's latest entry, always — the compensating action applies
      directly: restore a delete, delete an import or a restore, revert an
      update;
    - an older *update*, only while the record is live and every field it
      changed still holds the value it set — the revert then touches exactly
      those fields and leaves later edits to others alone;
    - never an older delete (a later restore already negated it) nor an older
      import or restore (compensating those would discard the edits that
      followed);
    - a merge or an un-merge, only as the latest entry, by that same rule —
      each is one act over several records, so compensating it means taking the
      whole thing back: the record that survived gives up what it absorbed, and
      the records that left come back. What followed an older one was written
      against the merged record;
    - never a rename, which changed a name for every publication that credits
      it. Renaming the name again in names management takes it back;
    - never a decision, which is taken back in the duplicate review.

  `head` is the stream's latest entry that is not a decision (see `head/1`).
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

  # Whether every field an entry changed still holds that entry's value in the
  # current state — the condition for an older update to remain undoable.
  defp untouched_since?(previous, current, head) do
    previous
    |> changed_keys(current)
    |> Enum.all?(&(not field_changed?(current, head, &1)))
  end

  @doc """
  The state undoing an update produces: the record as it stands now, with
  exactly the fields that update changed put back to their pre-change values.
  For a record's latest update that equals its previous snapshot; for an older
  one, later changes to other fields survive.
  """
  def reverted_snapshot(entry, previous, head) do
    previous.snapshot
    |> changed_keys(entry.snapshot)
    |> Enum.reduce(head.snapshot, &Map.put(&2, &1, previous.snapshot[&1]))
    |> Map.drop(@derived)
  end

  # The fields that differ between two snapshots, ignoring the derived ones.
  defp changed_keys(previous, current) do
    (Map.keys(previous) ++ Map.keys(current))
    |> Enum.uniq()
    |> Enum.reject(&(&1 in @derived))
    |> Enum.filter(&field_changed?(previous, current, &1))
  end

  # Sources are compared as a list rather than by value, and a missing list is
  # the same as an empty one. The sets of names are compared by their members,
  # so a snapshot that lists them in another order holds the same set.
  defp field_changed?(a, b, "sources"), do: (a["sources"] || []) != (b["sources"] || [])
  defp field_changed?(a, b, field) when field in @sets, do: sorted(a[field]) != sorted(b[field])
  defp field_changed?(a, b, field), do: a[field] != b[field]

  # Structural only — field keys and raw values, no labels and no formatting.
  # What a reader should *see* is the frontend's business; keeping the wire
  # structural means one payload serves any presentation, in any language.
  defp diff(nil, _entry), do: nil

  # A merge and an un-merge change the surviving record's own fields as surely
  # as an edit does, so they are diffed the same way — what it gained, against
  # what it gave back. Together with the records the entry names, that is the
  # whole of what the act did to the data. A rename changes the fields that
  # hold the name, and is diffed the same way too.
  defp diff(previous, entry = %History{action: action})
       when action in ["updated", "merged", "unmerged", "renamed"],
       do: compare(previous, entry)

  defp diff(_previous, _entry), do: nil

  # The structural diff between two snapshots: changed fields with their raw
  # before and after values, and sources as added, removed or reordered.
  defp compare(%History{snapshot: previous}, %History{snapshot: current}) do
    fields =
      (Map.keys(previous) ++ Map.keys(current))
      |> Enum.uniq()
      |> Enum.reject(&(&1 in @undiffed))
      |> Enum.filter(&field_changed?(previous, current, &1))
      |> Map.new(&{&1, %{from: previous[&1], to: current[&1]}})

    %{fields: fields, sources: source_change(previous["sources"], current["sources"])}
  end

  # `--` is multiset difference, so a source duplicated and removed once shows
  # up removed exactly once. Same entries in a new order is a reorder, not a
  # removal plus an addition.
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
  The flattened state stored with a history entry: the record as it stands,
  with its associations collapsed to the flat fields the client speaks in.

  Comparing two of these is how callers tell an edit that changed something
  from one that did not — the changeset cannot answer that, because sources
  are replaced wholesale on every save and so always look dirty.

  ## Examples

  Associations arrive flattened, as they are stored:

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

  # The next version for a record's stream, counting from its current maximum so
  # versions stay contiguous per publication rather than global.
  defp next_version(publication_id) do
    max =
      from(h in History, where: h.publication_id == ^publication_id, select: max(h.version))
      |> Repo.one()

    (max || 0) + 1
  end
end
