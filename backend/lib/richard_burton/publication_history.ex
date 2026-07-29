defmodule RichardBurton.Publication.History do
  @moduledoc """
  Append-only log of publication mutations: one immutable row per change, with
  the action, a flattened snapshot of the record after it, the acting user, and
  a per-publication version so each record's history reads as an ordered
  stream.

  Immutability is enforced by the database — a guard trigger rejects UPDATE and
  DELETE on the table (see the soft-delete migration) — and completeness by
  chokepoint: every mutation flows through the `Publication` context functions,
  which call `record/3` inside the mutating transaction, so a change and its
  history row commit or roll back together.
  """

  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query

  alias RichardBurton.Publication
  alias RichardBurton.Publication.Codec
  alias RichardBurton.Publication.History
  alias RichardBurton.Repo

  @actions ["created", "updated", "deleted", "restored", "merged"]

  # Mutations outside a request (seeds, mix tasks) are attributed to "system".
  @system_actor "system"

  # Snapshot keys the server owns rather than an editor: the surrogate id and
  # the fingerprints kept for conflict detection. Never diffed, and stripped
  # before a snapshot is fed back through the write path.
  @derived ~w[id countries_fingerprint translated_book_fingerprint publishers_fingerprint]

  # References are compared as a list rather than as a value, so they are
  # handled apart from the scalar fields.
  @undiffed ["references" | @derived]

  schema "publication_history" do
    field(:publication_id, :integer)
    field(:version, :integer)
    field(:action, :string)
    field(:snapshot, :map)
    field(:actor, :string)

    # What this version changed relative to the previous one.
    field(:diff, :map, virtual: true)
    # Whether this version can still be undone
    field(:undoable, :boolean, virtual: true)

    timestamps(updated_at: false)
  end

  @doc false
  def changeset(history, attrs) do
    history
    |> cast(attrs, [:publication_id, :version, :action, :snapshot, :actor])
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
  def record(action, publication = %Publication{}, actor)
      when action in [:created, :updated, :deleted, :restored, :merged] do
    %History{}
    |> changeset(%{
      publication_id: publication.id,
      version: next_version(publication.id),
      action: to_string(action),
      snapshot: snapshot(publication),
      actor: actor
    })
    |> Repo.insert!()
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

    heads = Map.new(streams, fn {id, [head | _]} -> {id, head} end)

    Enum.map(entries, fn entry ->
      previous = Map.get(previous, {entry.publication_id, entry.version})
      head = Map.fetch!(heads, entry.publication_id)

      %{entry | diff: diff(previous, entry), undoable: undoable?(entry, previous, head)}
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
    - never a merge, at any age: putting the record back would leave what it
      brought with the publication it was merged into, and there would be two
      of everything again. Undoing a merge means taking one apart, which is a
      different thing from compensating a change.
  """
  def undoable?(entry, previous, head) do
    cond do
      entry.action == "merged" -> false
      head.action == "merged" -> false
      entry.version == head.version -> true
      entry.action != "updated" -> false
      head.action == "deleted" -> false
      is_nil(previous) -> false
      true -> untouched_since?(previous.snapshot, entry.snapshot, head.snapshot)
    end
  end

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

  defp changed_keys(previous, current) do
    (Map.keys(previous) ++ Map.keys(current))
    |> Enum.uniq()
    |> Enum.reject(&(&1 in @derived))
    |> Enum.filter(&field_changed?(previous, current, &1))
  end

  defp field_changed?(a, b, "references"), do: (a["references"] || []) != (b["references"] || [])
  defp field_changed?(a, b, field), do: a[field] != b[field]

  # Structural only — field keys and raw values, no labels and no formatting.
  # What a reader should *see* is the frontend's business; keeping the wire
  # structural means one payload serves any presentation, in any language.
  defp diff(nil, _entry), do: nil
  defp diff(previous, entry = %History{action: "updated"}), do: compare(previous, entry)
  defp diff(_previous, _entry), do: nil

  defp compare(%History{snapshot: previous}, %History{snapshot: current}) do
    fields =
      (Map.keys(previous) ++ Map.keys(current))
      |> Enum.uniq()
      |> Enum.reject(&(&1 in @undiffed))
      |> Enum.filter(&(previous[&1] != current[&1]))
      |> Map.new(&{&1, %{from: previous[&1], to: current[&1]}})

    %{fields: fields, references: reference_change(previous["references"], current["references"])}
  end

  # `--` is multiset difference, so a reference duplicated and removed once shows
  # up removed exactly once. Same entries in a new order is a reorder, not a
  # removal plus an addition.
  defp reference_change(previous, current) do
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
  from one that did not — the changeset cannot answer that, because references
  are replaced wholesale on every save and so always look dirty.

  ## Examples

  Associations arrive flattened, as they are stored:

      iex> alias RichardBurton.{Author, Country, OriginalBook, Publication, Publisher, TranslatedBook}
      iex> publication = %Publication{
      ...>   title: "Dom Casmurro",
      ...>   year: 1953,
      ...>   countries: [%Country{code: "US"}],
      ...>   publishers: [%Publisher{name: "Noonday Press"}],
      ...>   references: [],
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
      {"Dom Casmurro", "Helen Caldwell", "US"}
  """
  def snapshot(publication = %Publication{}) do
    publication
    |> Codec.flatten()
    |> Map.from_struct()
    |> Map.delete(:__meta__)
  end

  defp next_version(publication_id) do
    max =
      from(h in History, where: h.publication_id == ^publication_id, select: max(h.version))
      |> Repo.one()

    (max || 0) + 1
  end
end
