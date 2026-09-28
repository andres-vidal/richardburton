defmodule RichardBurton.Document do
  @moduledoc """
  One batch of import work under a name: rows being prepared for the database,
  kept between sittings.

  The list of documents is shared. There is no owner and no membership — the
  database being prepared is one database, and everyone keeping it is working
  towards the same thing, so anyone who may edit publications may open any
  document.

  A document's content is a Yjs document, which this never parses. A Yjs
  document is a set of updates that can be applied in any order and more than
  once, so appending them and handing them back is the whole of what holding one
  requires. Keeping the server blind is what keeps a precompiled native
  dependency out of the deployment; the two moments anything must actually read
  the rows — validating and submitting — already take ordinary JSON over the
  publication endpoints.

  Three words carry specific meanings here:

    * **update** — one opaque change to the content, as Yjs encoded it.
    * **compaction** — one update that means the same as every update up to a
      stated point, written in their place. What keeps a long-lived document
      cheap to open. It is an ordinary update once written: nothing marks it,
      and nothing reads it differently.
    * **archiving** — retiring a document from the list without destroying what
      it holds.
    * **cursor** — the position a page of the list is read from: the
      `updated_at` and id of the last document the page before it held.

  `rows` is a count the client writes when it writes, since the server cannot
  count rows in bytes it does not parse. It is what the list shows, and it is
  the client's word.
  """

  use Ecto.Schema

  import Ecto.Changeset
  import Ecto.Query

  alias RichardBurton.Document
  alias RichardBurton.Repo

  @default_limit 50
  @max_limit 200

  @derive {Jason.Encoder, only: [:id, :name, :rows, :archived_at, :inserted_at, :updated_at]}
  schema "documents" do
    field(:name, :string)
    field(:rows, :integer, default: 0)
    field(:archived_at, :utc_datetime)

    # To the microsecond, since the list is ordered by when each last changed.
    timestamps(type: :naive_datetime_usec)
  end

  defmodule Update do
    @moduledoc """
    One opaque change to a document's content, in the order it was written.
    """

    use Ecto.Schema

    alias RichardBurton.Document

    schema "document_updates" do
      belongs_to(:document, Document)

      field(:update, :binary)

      timestamps(updated_at: false)
    end
  end

  @doc false
  def changeset(document, attrs) do
    document
    |> cast(attrs, [:name, :rows])
    |> validate_required([:name])
    |> validate_length(:name, min: 1, max: 200)
    |> validate_number(:rows, greater_than_or_equal_to: 0)
  end

  @doc "Start a document."
  def create(attrs) do
    %Document{} |> changeset(attrs) |> Repo.insert()
  end

  @doc """
  A page of the documents, most recently changed first, and whether more follow
  it.

  All of them, for everyone: the list is shared, so there is nobody to scope it
  to. The ones on offer are read unless `archived: true` asks for the ones
  taken off the list instead. Two changed at the same instant are ordered by
  which was started later, so the list does not shuffle between reads.

  `limit` bounds the read. A workspace that has been kept for years holds more
  documents than anyone reads at once, and a list with no end to it grows until
  it is the slowest page in the application.

  `after` is the cursor of the page before, and the page starts with the
  document that follows it. Reading from a position rather than skipping a count
  keeps a page from repeating or missing a document that changed between reads:
  a change moves that document to the top, which would shift every count below
  it by one.
  """
  def page(opts \\ []) do
    limit = opts |> Keyword.get(:limit, @default_limit) |> bound()

    # One more than the page holds, which is what says whether more follow.
    read =
      from(d in Document, order_by: [desc: d.updated_at, desc: d.id], limit: ^(limit + 1))
      |> on_the_list(Keyword.get(opts, :archived, false))
      |> following(Keyword.get(opts, :after))
      |> Repo.all()

    %{entries: Enum.take(read, limit), more: length(read) > limit}
  end

  # Which side of the list to read: what is on offer, or what has been retired
  # from it. Restoring one means being able to see it, so both are readable.
  defp on_the_list(query, true), do: from(d in query, where: not is_nil(d.archived_at))
  defp on_the_list(query, _), do: from(d in query, where: is_nil(d.archived_at))

  # Only the documents that come after the cursor, in the list's order.
  defp following(query, nil), do: query

  defp following(query, {updated_at, id}) do
    from(d in query,
      where: d.updated_at < ^updated_at or (d.updated_at == ^updated_at and d.id < ^id)
    )
  end

  # Keeps a caller from asking for the whole table by naming a large enough page.
  defp bound(limit) when is_integer(limit) and limit > 0, do: min(limit, @max_limit)
  defp bound(_), do: @default_limit

  @doc """
  The document, or `:not_found`.

  An archived document is still found by id, so a link to one that somebody has
  open does not break under them.
  """
  def find(id) do
    case Repo.get(Document, id) do
      nil -> {:error, :not_found}
      document -> {:ok, document}
    end
  end

  @doc "Give a document a different name."
  def rename(document = %Document{}, name) do
    document |> changeset(%{"name" => name}) |> Repo.update()
  end

  @doc """
  Take a document off the list, keeping what it holds.

  Archiving is not deleting: the rows are a record of what was prepared, and the
  updates stay where they are. An archived document is reachable by id and can
  be brought back.
  """
  def archive(document = %Document{}) do
    document
    |> change(archived_at: DateTime.utc_now(:second))
    |> Repo.update()
  end

  @doc "Put an archived document back on the list."
  def unarchive(document = %Document{}) do
    document |> change(archived_at: nil) |> Repo.update()
  end

  @doc """
  Everything needed to rebuild this document's content, with the id of the last
  update it includes.

  A reader applies them in any order and is then holding what everyone else
  holds. The id is what a later compaction names as the point its merge reaches,
  so that whatever is appended in between is kept rather than replaced.

  `after` reads only the updates written after that id, for a reader that
  already holds the ones up to it. Where nothing has been written since, the id
  returned is the one it was given. This misses nothing because every write to
  a document's updates holds the document's lock until it commits, so they
  commit one at a time and in the order of their ids. Once an id has been read,
  no update with a smaller one is still to come.

  Every row after that point is read, compactions included, with nothing
  skipped on the strength of one. A compaction has already deleted what it
  stands for, so what is left beside it is what it does not stand for. Reading
  an update twice costs nothing, since Yjs applies an update it already holds as
  nothing at all.
  """
  def updates(%Document{id: id}, opts \\ []) do
    since = Keyword.get(opts, :after, 0)

    rows =
      Repo.all(
        from(u in Update,
          where: u.document_id == ^id and u.id > ^since,
          order_by: [asc: u.id]
        )
      )

    {Enum.map(rows, & &1.update), last_id(rows, since)}
  end

  # The id of the last update read, or the point the read started from where
  # there was nothing after it.
  defp last_id([], since), do: since
  defp last_id(rows, _since), do: List.last(rows).id

  @doc """
  Append a change to a document, and record the row count that came with it.

  The count is the client's, since the server does not read the content. The
  document's `updated_at` moves with it, which is what orders the list. `nil`
  leaves the count already recorded alone rather than refusing the change: the
  change is the thing worth keeping, and the count is what the list shows.
  """
  def append(document = %Document{}, update, rows)
      when is_binary(update) and (is_integer(rows) or is_nil(rows)) do
    Repo.transaction(fn ->
      lock!(document)
      Repo.insert!(%Update{document_id: document.id, update: update})

      document
      |> changeset(%{"rows" => rows || document.rows})
      |> force_change(:updated_at, NaiveDateTime.utc_now())
      |> Repo.update!()
    end)
  end

  @doc """
  Write one update in place of every update up to `through`.

  The merged update is the caller's: only a client reads the content, so only a
  client can merge it. `through` is the last update the caller had when it
  merged, and anything appended past that point is left alone — somebody else
  was typing while the merge was being made, and their change is not the merge's
  to replace.

  What the merge stands for is deleted in the same transaction, so a reader
  never sees the two together.
  """
  def compact(document = %Document{}, merged, through)
      when is_binary(merged) and is_integer(through) do
    Repo.transaction(fn ->
      lock!(document)

      Repo.delete_all(
        from(u in Update, where: u.document_id == ^document.id and u.id <= ^through)
      )

      Repo.insert!(%Update{document_id: document.id, update: merged})
    end)
  end

  # Holds the document's row lock until the transaction ends. Every write to a
  # document's updates takes it before its update is given an id, so two writes
  # to one document commit in the order of their ids. `updates/2` relies on that
  # to read only what follows a point.
  defp lock!(%Document{id: id}) do
    Repo.one!(from(d in Document, where: d.id == ^id, select: d.id, lock: "FOR UPDATE"))
  end
end
