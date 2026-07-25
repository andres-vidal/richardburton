defmodule RichardBurton.Publication do
  @moduledoc """
  Schema for publications
  """
  use Ecto.Schema
  import Ecto.Changeset
  import RichardBurton.Validation

  require Ecto.Query

  alias RichardBurton.Country
  alias RichardBurton.Publication
  alias RichardBurton.Publication.Codec
  alias RichardBurton.Publication.History
  alias RichardBurton.Publication.Index
  alias RichardBurton.Publisher
  alias RichardBurton.Reference
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook
  alias RichardBurton.Validation

  @readable_attributes [:countries, :publishers, :title, :year, :translated_book]

  @derive {Jason.Encoder, only: @readable_attributes}
  schema "publications" do
    field(:title, :string)
    field(:year, :integer)
    field(:translated_book_fingerprint, :string)
    field(:countries_fingerprint, :string)
    field(:publishers_fingerprint, :string)
    field(:deleted_at, :utc_datetime)

    belongs_to(:translated_book, TranslatedBook, on_replace: :nilify)

    many_to_many(:countries, Country,
      join_through: "publication_countries",
      on_replace: :delete
    )

    many_to_many(:publishers, Publisher,
      join_through: "publication_publishers",
      on_replace: :delete
    )

    # Owned provenance: replaced wholesale on edit (children carry no client id,
    # so cast_assoc treats every incoming entry as new), preloaded in order.
    has_many(:references, Reference,
      on_replace: :delete,
      preload_order: [asc: :position]
    )

    timestamps()
  end

  @doc false
  def changeset(publication, attrs \\ %{})

  @doc false
  def changeset(publication, attrs = %Publication{}) do
    changeset(publication, Map.from_struct(attrs))
  end

  @doc false
  def changeset(publication, attrs) do
    publication
    |> cast(attrs, [:title, :year])
    |> cast_assoc(:translated_book, required: true)
    |> cast_assoc(:countries, required: true)
    |> cast_assoc(:publishers, required: true)
    |> cast_assoc(:references)
    |> validate_length(:countries, min: 1)
    |> validate_no_duplicates(:countries, :code)
    |> validate_no_duplicates(:publishers, :name)
    |> validate_required([:title, :year])
    |> unique_constraint(
      [
        :title,
        :year,
        :publishers_fingerprint,
        :countries_fingerprint,
        :translated_book_fingerprint
      ],
      name: "publications_composite_key"
    )
    |> link_fingerprints()
  end

  def all do
    Publication
    |> Repo.all()
    |> preload
  end

  def preload(data) do
    Repo.preload(data, [
      :countries,
      :publishers,
      :references,
      translated_book: [:authors, original_book: [:authors]]
    ])
  end

  def insert(attrs, actor \\ History.system_actor()) do
    # The insert and its history row commit or roll back together.
    Repo.transaction(fn ->
      %Publication{}
      |> changeset(attrs)
      |> link_assocs()
      |> Repo.insert()
      |> case do
        {:ok, publication} ->
          publication = preload(publication)
          History.record(:created, publication, actor)
          publication

        {:error, changeset} ->
          Repo.rollback(Validation.get_errors(changeset))
      end
    end)
  end

  def validate(attrs) do
    Validation.validate(changeset(%Publication{}, attrs), &link_assocs/1)
  end

  def update(id, attrs, actor \\ History.system_actor()) do
    case get(id, deleted: false) do
      nil ->
        {:error, :not_found}

      publication ->
        publication |> update_and_record(attrs, actor) |> refresh_if_changed()
    end
  end

  # A save that changed nothing leaves the index alone too.
  defp refresh_if_changed({:ok, {updated, true}}) do
    Index.Refresher.refresh()
    {:ok, updated}
  end

  defp refresh_if_changed({:ok, {updated, false}}), do: {:ok, updated}
  defp refresh_if_changed(error), do: error

  defp update_and_record(publication, attrs, actor) do
    # Snapshots are the yardstick, not the changeset: cast_assoc(:references)
    # treats every incoming entry as new (children carry no client id), so a
    # changeset always looks dirty even when the record is untouched.
    before = History.snapshot(preload(publication))

    # The update and its history row commit or roll back together.
    Repo.transaction(fn ->
      publication
      |> preload()
      |> changeset(attrs)
      |> link_assocs()
      |> Repo.update()
      |> case do
        {:ok, updated} -> record_if_changed(preload(updated), before, actor)
        {:error, changeset} -> Repo.rollback(Validation.get_errors(changeset))
      end
    end)
  end

  # Re-saving a record unchanged is not an event worth logging.
  defp record_if_changed(updated, before, actor) do
    case History.snapshot(updated) != before do
      true ->
        History.record(:updated, updated, actor)
        {updated, true}

      false ->
        {updated, false}
    end
  end

  @doc """
  Soft-delete a publication: stamp `deleted_at`, so every read path hides it
  while its row, references, and history survive — and `restore/2` can bring
  it back. The final state rides along in the history snapshot.
  """
  def delete(id, actor \\ History.system_actor()) do
    case get(id, deleted: false) do
      nil -> {:error, :not_found}
      publication -> stamp_deleted(publication, DateTime.utc_now(:second), :deleted, actor)
    end
  end

  @doc """
  Undo one recorded change, by applying the action that compensates it.

  Nothing is erased: the log is append-only, so the undo lands as a new entry of
  its own and is itself undoable. Eligibility is decided here rather than
  trusted from the caller — the rule (see `History.undoable?/3`) is an invariant
  of the log, not an affordance of whichever client happens to be asking.
  """
  def undo(id, version, actor \\ History.system_actor()) do
    stream = History.of(id)
    entry = Enum.find(stream, &(&1.version == version))

    cond do
      is_nil(entry) -> {:error, :not_found}
      not entry.undoable -> {:error, :conflict}
      true -> compensate(entry, previous_of(stream, entry), List.first(stream), actor)
    end
  end

  defp previous_of(stream, entry) do
    Enum.find(stream, &(&1.version < entry.version))
  end

  defp compensate(%{action: action, publication_id: id}, _previous, _head, actor)
       when action in ["created", "restored"] do
    delete(id, actor)
  end

  defp compensate(%{action: "deleted", publication_id: id}, _previous, _head, actor) do
    restore(id, actor)
  end

  defp compensate(entry = %{action: "updated", publication_id: id}, previous, head, actor) do
    entry
    |> History.reverted_snapshot(previous, head)
    |> Codec.nest()
    |> then(&update(id, &1, actor))
  end

  @doc "Bring a soft-deleted publication back into the catalogue."
  def restore(id, actor \\ History.system_actor()) do
    case get(id, deleted: true) do
      nil -> {:error, :not_found}
      publication -> stamp_deleted(publication, nil, :restored, actor)
    end
  end

  defp stamp_deleted(publication, deleted_at, action, actor) do
    publication = preload(publication)

    result =
      Repo.transaction(fn ->
        publication
        |> change(deleted_at: deleted_at)
        # Restoring re-enters the partial composite-key index — if the same
        # record was re-imported meanwhile, that's a conflict, not a crash.
        |> unique_constraint(
          [
            :title,
            :year,
            :publishers_fingerprint,
            :countries_fingerprint,
            :translated_book_fingerprint
          ],
          name: "publications_composite_key"
        )
        |> Repo.update()
        |> case do
          {:ok, _} -> History.record(action, publication, actor)
          {:error, changeset} -> Repo.rollback(Validation.get_errors(changeset))
        end
      end)

    case result do
      {:ok, _} ->
        # One signal per operation, after commit (the new-write-path rule).
        Index.Refresher.refresh()
        {:ok, publication}

      error ->
        error
    end
  end

  @doc "The soft-deleted publications, most recently deleted first."
  def all_deleted do
    Ecto.Query.from(p in Publication,
      where: not is_nil(p.deleted_at),
      order_by: [desc: p.deleted_at]
    )
    |> Repo.all()
    |> preload()
  end

  defp get(id, deleted: false) do
    Repo.one(Ecto.Query.from(p in Publication, where: p.id == ^id and is_nil(p.deleted_at)))
  end

  defp get(id, deleted: true) do
    Repo.one(Ecto.Query.from(p in Publication, where: p.id == ^id and not is_nil(p.deleted_at)))
  end

  defp link_fingerprints(changeset) do
    changeset
    |> TranslatedBook.link_fingerprint()
    |> Country.link_fingerprint()
    |> Publisher.link_fingerprint()
  end

  defp link_assocs(changeset) do
    changeset
    |> Country.link()
    |> TranslatedBook.link()
    |> Publisher.link()
  end

  def insert_all(attrs_list, actor \\ History.system_actor()) do
    result =
      Repo.transaction(fn ->
        Enum.map(attrs_list, &insert_or_rollback(&1, actor))
      end)

    case result do
      {:ok, _publications} ->
        # One signal for the whole batch — never per row, so the synchronous
        # refresh strategies don't rebuild N times.
        Index.Refresher.refresh()
        result

      error ->
        # Rolled back: nothing changed, so the index needs no refresh.
        error
    end
  end

  defp insert_or_rollback(attrs, actor) do
    case insert(attrs, actor) do
      {:ok, publication} ->
        publication

      {:error, errors} ->
        Repo.rollback({attrs, errors})
    end
  end
end
