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

  Two words carry specific meanings here:

    * **update** — one opaque change to the content, as Yjs encoded it.
    * **compaction** — replacing every update of a document with one merged
      update that means the same thing. What keeps a long-lived document cheap
      to open.

  `rows` is a count the client writes when it writes, since the server cannot
  count rows in bytes it does not parse. It is what the list shows, and it is
  the client's word.
  """

  use Ecto.Schema

  import Ecto.Changeset
  import Ecto.Query

  alias RichardBurton.Document
  alias RichardBurton.Repo

  @derive {Jason.Encoder, only: [:id, :name, :rows, :inserted_at, :updated_at]}
  schema "documents" do
    field(:name, :string)
    field(:rows, :integer, default: 0)

    timestamps()
  end

  defmodule Update do
    @moduledoc """
    One opaque change to a document's content, in the order it was written.

    `compacted` marks a row that stands for every update before it.
    """

    use Ecto.Schema

    schema "document_updates" do
      field(:document_id, :integer)
      field(:update, :binary)
      field(:compacted, :boolean, default: false)

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
  Every document, most recently changed first.

  All of them, for everyone: the list is shared, so there is nobody to scope it
  to. Two changed in the same second are ordered by which was started later, so
  the list does not shuffle between reads.
  """
  def all do
    from(d in Document, order_by: [desc: d.updated_at, desc: d.id]) |> Repo.all()
  end

  @doc "The document, or `:not_found`."
  def find(id) do
    case Repo.get(Document, id) do
      nil -> {:error, :not_found}
      document -> {:ok, document}
    end
  end

  @doc """
  Everything needed to rebuild this document's content, oldest first.

  A compaction stands for every update before it, so reading starts at the last
  one rather than at the beginning.
  """
  def updates(%Document{id: id}) do
    from(u in Update, where: u.document_id == ^id, order_by: [asc: u.id], select: u.update)
    |> from_last_compaction(id)
    |> Repo.all()
  end

  # Narrows the read to what has happened since the last compaction, which is
  # the whole of the content by definition.
  defp from_last_compaction(query, id) do
    case Repo.one(
           from(u in Update,
             where: u.document_id == ^id and u.compacted,
             order_by: [desc: u.id],
             limit: 1,
             select: u.id
           )
         ) do
      nil -> query
      at -> from(u in query, where: u.id >= ^at)
    end
  end

  @doc """
  Append a change to a document, and record the row count that came with it.

  The count is the client's, since the server does not read the content. The
  document's `updated_at` moves with it, which is what orders the list.
  """
  def append(document = %Document{}, update, rows) when is_binary(update) do
    Repo.transaction(fn ->
      Repo.insert!(%Update{document_id: document.id, update: update})

      document
      |> changeset(%{"rows" => rows})
      |> Ecto.Changeset.force_change(:updated_at, NaiveDateTime.utc_now(:second))
      |> Repo.update!()
    end)
  end

  @doc """
  Replace a document's updates with one that means the same thing.

  The merged update is the caller's: only a client reads the content, so only a
  client can merge it. Everything it stands for is deleted in the same
  transaction, so a reader never sees the two together.
  """
  def compact(document = %Document{}, merged) when is_binary(merged) do
    Repo.transaction(fn ->
      Repo.delete_all(from(u in Update, where: u.document_id == ^document.id))
      Repo.insert!(%Update{document_id: document.id, update: merged, compacted: true})
    end)
  end
end
