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
      cheap to open.
    * **archiving** — retiring a document from the list without destroying what
      it holds.

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

    timestamps()
  end

  defmodule Update do
    @moduledoc """
    One opaque change to a document's content, in the order it was written.

    `compacted_through` is set on a row that stands for every update up to that
    id, and is `nil` on an ordinary one. Naming the point rather than marking a
    boolean is what lets a change appended while the merge was being made be
    kept rather than swept up with what the merge replaced.
    """

    use Ecto.Schema

    alias RichardBurton.Document

    schema "document_updates" do
      belongs_to(:document, Document)

      field(:update, :binary)
      field(:compacted_through, :integer)

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
  The documents on offer, most recently changed first.

  All of them, for everyone: the list is shared, so there is nobody to scope it
  to. Archived ones are left out, since being archived is what taking one off
  the list means. Two changed in the same second are ordered by which was
  started later, so the list does not shuffle between reads.

  `limit` and `offset` bound the read. A workspace that has been kept for years
  holds more documents than anyone reads at once, and a list with no end to it
  grows until it is the slowest page in the application.
  """
  def all(opts \\ []) do
    limit = opts |> Keyword.get(:limit, @default_limit) |> bound()
    offset = max(Keyword.get(opts, :offset, 0), 0)

    from(d in Document,
      order_by: [desc: d.updated_at, desc: d.id],
      limit: ^limit,
      offset: ^offset
    )
    |> on_the_list(Keyword.get(opts, :archived, false))
    |> Repo.all()
  end

  @doc """
  How many there are, which is what says whether there are more to ask for.

  Counts the same side of the list as `all/1` was asked for.
  """
  def count(opts \\ []) do
    from(d in Document, select: count(d.id))
    |> on_the_list(Keyword.get(opts, :archived, false))
    |> Repo.one()
  end

  # Which side of the list to read: what is on offer, or what has been retired
  # from it. Restoring one means being able to see it, so both are readable.
  defp on_the_list(query, true), do: from(d in query, where: not is_nil(d.archived_at))
  defp on_the_list(query, _), do: from(d in query, where: is_nil(d.archived_at))

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

  Reading starts from the furthest-reaching compaction, which stands for
  everything up to the point it names, and takes every update appended past that
  point alongside it.
  """
  def updates(%Document{id: id}) do
    case compaction(id) do
      nil ->
        rows = Repo.all(from(u in Update, where: u.document_id == ^id, order_by: [asc: u.id]))
        {Enum.map(rows, & &1.update), last_id(rows)}

      merged ->
        rest =
          Repo.all(
            from(u in Update,
              where:
                u.document_id == ^id and u.id > ^merged.compacted_through and u.id != ^merged.id,
              order_by: [asc: u.id]
            )
          )

        {[merged.update | Enum.map(rest, & &1.update)], max(merged.id, last_id(rest))}
    end
  end

  # The compaction that reaches furthest, which is the one worth reading from.
  # Taken by what it covers rather than by when it was written, since two of them
  # can be written out of that order.
  defp compaction(id) do
    Repo.one(
      from(u in Update,
        where: u.document_id == ^id and not is_nil(u.compacted_through),
        order_by: [desc: u.compacted_through],
        limit: 1
      )
    )
  end

  defp last_id([]), do: 0
  defp last_id(rows), do: rows |> Enum.map(& &1.id) |> Enum.max()

  @doc """
  Append a change to a document, and record the row count that came with it.

  The count is the client's, since the server does not read the content. The
  document's `updated_at` moves with it, which is what orders the list. A count
  that is not a number leaves the one already recorded alone rather than
  refusing the change: the change is the thing worth keeping, and the count is
  what the list shows.
  """
  def append(document = %Document{}, update, rows) when is_binary(update) do
    Repo.transaction(fn ->
      Repo.insert!(%Update{document_id: document.id, update: update})

      document
      |> changeset(%{"rows" => counted(rows, document.rows)})
      |> force_change(:updated_at, NaiveDateTime.utc_now(:second))
      |> Repo.update!()
    end)
  end

  # The row count to record: the one given where it is a count, and the one
  # already held where it is not.
  defp counted(rows, _held) when is_integer(rows) and rows >= 0, do: rows

  defp counted(rows, held) when is_binary(rows) do
    case Integer.parse(rows) do
      {parsed, ""} when parsed >= 0 -> parsed
      _ -> held
    end
  end

  defp counted(_rows, held), do: held

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
      Repo.delete_all(
        from(u in Update, where: u.document_id == ^document.id and u.id <= ^through)
      )

      Repo.insert!(%Update{
        document_id: document.id,
        update: merged,
        compacted_through: through
      })
    end)
  end
end
