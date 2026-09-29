defmodule RichardBurton.Document do
  @moduledoc """
  An import document: a named batch of rows being prepared for the database,
  stored so that work on it can continue later.

  The list of documents is shared. A document has no owner and no members,
  because everyone preparing the database works on the same data. Anyone who
  may edit publications may open any document.

  A document's content is a Yjs document, and this module never parses it. A
  Yjs document is a set of updates that can be applied in any order and more
  than once, so storing one only needs appending updates and returning them.
  Because the server does not parse Yjs, the deployment needs no precompiled
  native dependency. Validating and submitting the rows use the publication
  endpoints, which take plain JSON.

  These terms have specific meanings here:

    * **update** — one change to the content, as Yjs encoded it, stored as
      opaque bytes.
    * **compaction** — one update that has the same effect as every update up
      to a given id, written in their place. It keeps the number of updates a
      long-lived document has to load small. Once written it is an ordinary
      update, and nothing marks it or reads it differently.
    * **archiving** — taking a document off the list without deleting its
      content.
    * **cursor** — the position a page of the list starts after: the
      `updated_at` and id of the last document on the previous page.

  `rows` is the row count given with each write. The server cannot count rows
  in content it does not parse, so it stores the count as given and does not
  check it.
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

    # Microsecond precision, because the list is ordered by `updated_at`.
    timestamps(type: :naive_datetime_usec)
  end

  defmodule Update do
    @moduledoc """
    One Yjs update to a document's content, stored as opaque bytes. Updates
    are written in the order of their ids.
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

  @doc "Creates a document from `attrs`, which must include a `name`."
  def create(attrs) do
    %Document{} |> changeset(attrs) |> Repo.insert()
  end

  @doc """
  Returns a page of documents, most recently changed first, as
  `%{entries: documents, more: boolean}`. `more` is true when more documents
  follow the page.

  The page is not scoped to a person, because the list is shared. It holds the
  documents that are not archived, or only the archived ones when
  `archived: true` is given. Documents with the same `updated_at` are ordered
  by id, newest first, so the order is the same on every read.

  `limit` sets the page size. It defaults to 50 and is capped at 200, so a
  read never returns the whole table.

  `after` is a cursor, and the page starts with the document that follows it.
  A cursor is used instead of an offset because a change moves a document to
  the top of the list. With an offset, that move would shift every document
  below it by one, and a page could repeat or skip a document.
  """
  def page(opts \\ []) do
    limit = opts |> Keyword.get(:limit, @default_limit) |> bound()

    # Reads one more document than the limit. If it exists, more follow.
    read =
      from(d in Document, order_by: [desc: d.updated_at, desc: d.id], limit: ^(limit + 1))
      |> on_the_list(Keyword.get(opts, :archived, false))
      |> following(Keyword.get(opts, :after))
      |> Repo.all()

    %{entries: Enum.take(read, limit), more: length(read) > limit}
  end

  # Keeps only archived documents when the second argument is `true`, and only
  # unarchived ones otherwise. Archived documents can be listed so that one can
  # be found and unarchived.
  defp on_the_list(query, true), do: from(d in query, where: not is_nil(d.archived_at))
  defp on_the_list(query, _), do: from(d in query, where: is_nil(d.archived_at))

  # Keeps only the documents that come after the cursor `{updated_at, id}` in
  # the list's order. A `nil` cursor keeps all of them.
  defp following(query, nil), do: query

  defp following(query, {updated_at, id}) do
    from(d in query,
      where: d.updated_at < ^updated_at or (d.updated_at == ^updated_at and d.id < ^id)
    )
  end

  # Caps a positive `limit` at the maximum page size. Any other value gives the
  # default page size.
  defp bound(limit) when is_integer(limit) and limit > 0, do: min(limit, @max_limit)
  defp bound(_), do: @default_limit

  @doc """
  Returns `{:ok, document}` for the id, or `{:error, :not_found}`.

  It finds archived documents too, so an archived document stays reachable by
  id.
  """
  def find(id) do
    case Repo.get(Document, id) do
      nil -> {:error, :not_found}
      document -> {:ok, document}
    end
  end

  @doc "Renames a document."
  def rename(document = %Document{}, name) do
    document |> changeset(%{"name" => name}) |> Repo.update()
  end

  @doc """
  Archives a document by setting `archived_at`. The document leaves the list,
  and its updates are kept.

  Archiving does not delete anything, because the rows are a record of what was
  prepared. An archived document can still be found by id and can be
  unarchived.
  """
  def archive(document = %Document{}) do
    document
    |> change(archived_at: DateTime.utc_now(:second))
    |> Repo.update()
  end

  @doc "Clears `archived_at`, which puts an archived document back on the list."
  def unarchive(document = %Document{}) do
    document |> change(archived_at: nil) |> Repo.update()
  end

  @doc """
  Returns `{updates, through}`: the document's updates in id order, and the id
  of the last one returned.

  Applying the updates in any order rebuilds the document's content. `through`
  is the id to pass to `compact/3` later, so that the compaction replaces only
  the updates that were read and keeps any appended after them.

  With `after: id`, only the updates with a larger id are returned. When there
  are none, `through` is the id that was given. No update is missed this way,
  because every write to a document's updates holds the document's row lock
  until it commits. Writes to one document therefore commit one at a time, in
  id order, and once an id has been read no update with a smaller id can still
  appear.

  Every update after the given id is returned, compactions included. A
  compaction deletes the updates it replaces, so any update left beside it is
  one it does not include. Returning an update that a reader already has does
  no harm, because Yjs ignores an update it has already applied.
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

  # Returns the id of the last row read, or `since` when no rows were read.
  defp last_id([], since), do: since
  defp last_id(rows, _since), do: List.last(rows).id

  @doc """
  Appends an update to a document and stores `rows` as its row count.

  It also sets the document's `updated_at` to now, which moves the document to
  the top of the list. When `rows` is `nil`, the stored count is kept and the
  update is still appended, so a missing count never loses an update.
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
  Replaces every update of the document up to `through` with the single update
  `merged`.

  The caller builds `merged`, because the server does not parse the content.
  `through` is the id of the last update the caller merged, as returned by
  `updates/2`. Updates with a larger id were appended after that read, so they
  are not in the merge and are kept.

  The old updates are deleted and `merged` is inserted in one transaction, so a
  reader never gets both.
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

  # Locks the document's row with `FOR UPDATE` until the transaction ends.
  # Every write to a document's updates takes this lock before inserting its
  # update, so writes to one document commit in the order of their ids.
  # `updates/2` relies on this when it reads only the updates after a given id.
  defp lock!(%Document{id: id}) do
    Repo.one!(from(d in Document, where: d.id == ^id, select: d.id, lock: "FOR UPDATE"))
  end
end
