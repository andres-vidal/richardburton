defmodule RichardBurton.Publication do
  @moduledoc """
  A publication: one translated edition of an original book, and the write paths
  that change one.

  Identity is a composite key: the title, the year, the translated book, and
  the fingerprints of the countries and publishers. The database computes and
  enforces it (see `RichardBurton.Identity`), so the same edition cannot be
  stored twice. The near-duplicates that key cannot catch are
  `Publication.Duplicates`.

  Five words carry specific meanings here:

    * **tombstone** — a soft-deleted row. `delete/2` sets `deleted_at` rather
      than removing anything, so the row, its sources and its history are kept
      and `restore/3` can bring it back. Every read leaves tombstones out, and
      the composite-key index is partial, so a tombstone never blocks
      importing the same publication again.
    * **winner** and **losers** — in a merge, the publication that is kept and
      the publications merged into it. The winner keeps its own fields. The
      losers add their countries, publishers and sources to it, and are then
      tombstoned.
    * **absorbed** — the state of a loser after the merge, as
      `Publication.History.absorbed/1` defines it. It is not in the trash, and
      `restore/3` refuses it with `{:error, :absorbed}`. Undoing the merge
      brings it back.
    * **compensate** — to apply the action that `undo/3` uses to reverse a
      recorded entry. The compensating action is recorded as a new entry, which
      can be undone in turn.

  A publication's `notes` are free text about it, written as Markdown, or nil
  when it has none. Blank notes are stored as nil. The notes are not part
  of the composite key, and the search does not read them.

  A publication's countries, publishers, translators and original authors are
  sets. The link tables keep no order, and a preload reads each set sorted, by
  code for countries and by name for the others, as the search index lists
  them. A history snapshot lists them in that order too, so two snapshots
  differ only when a set changed.

  Every mutation records an entry in `Publication.History` inside the same
  transaction, and signals `Publication.Index.Refresher` once per operation.
  """
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query, only: [order_by: 2]
  import RichardBurton.Validation

  require Ecto.Query

  alias RichardBurton.Country
  alias RichardBurton.Identity
  alias RichardBurton.Publication
  alias RichardBurton.Publication.Codec
  alias RichardBurton.Publication.History
  alias RichardBurton.Publication.Duplicates
  alias RichardBurton.Publication.Import
  alias RichardBurton.Publication.Index
  alias RichardBurton.Publication.Links
  alias RichardBurton.Publisher
  alias RichardBurton.Source
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook
  alias RichardBurton.Validation

  @readable_attributes [:countries, :publishers, :title, :year, :notes, :translated_book]

  @derive {Jason.Encoder, only: @readable_attributes}
  schema "publications" do
    field(:title, :string)
    field(:year, :integer)
    field(:notes, :string)
    # Written by the database from the linked countries and publishers.
    field(:countries_fingerprint, :string, writable: :never)
    field(:publishers_fingerprint, :string, writable: :never)
    field(:deleted_at, :utc_datetime)

    belongs_to(:translated_book, TranslatedBook, on_replace: :nilify)

    many_to_many(:countries, Country,
      join_through: "publication_countries",
      on_replace: :delete,
      preload_order: [asc: :code]
    )

    many_to_many(:publishers, Publisher,
      join_through: "publication_publishers",
      on_replace: :delete,
      preload_order: [asc: :name]
    )

    # The sources the publication cites, preloaded in position order. A source
    # in the attrs carries no id, so `cast_assoc/3` replaces them all on every
    # save.
    has_many(:sources, Source,
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
    |> cast(attrs, [:title, :year, :notes])
    |> cast_assoc(:translated_book, required: true)
    |> cast_assoc(:countries, required: true)
    |> cast_assoc(:publishers, required: true)
    |> cast_assoc(:sources)
    |> validate_length(:countries, min: 1)
    |> validate_no_duplicates(:countries, :code)
    |> validate_no_duplicates(:publishers, :name)
    |> validate_required([:title, :year])
    |> validate_notes()
  end

  @doc """
  Returns every publication row, tombstones included, ordered by id, which is
  the order they were inserted. Each row comes with its countries, publishers,
  sources and translated book preloaded.
  """
  def all do
    Publication
    |> order_by(:id)
    |> Repo.all()
    |> preload
  end

  @doc """
  Returns the publications with the ids `ids`, deleted ones included,
  preloaded, in the order of `ids`. Every id must be a stored publication's.

  The countries, publishers, translated book, original book and both lists of
  authors are read in one query that joins them, sorted the way the
  associations' `preload_order` sorts them. The sources are read in a second
  query, so that many sources do not multiply the rows of the first.
  """
  def with_ids(ids) do
    by_id =
      Ecto.Query.from(p in Publication,
        where: p.id in ^ids,
        left_join: c in assoc(p, :countries),
        left_join: pb in assoc(p, :publishers),
        left_join: tb in assoc(p, :translated_book),
        left_join: ta in assoc(tb, :authors),
        left_join: ob in assoc(tb, :original_book),
        left_join: oa in assoc(ob, :authors),
        order_by: [p.id, c.code, pb.name, ta.name, oa.name],
        preload: [
          countries: c,
          publishers: pb,
          translated_book: {tb, authors: ta, original_book: {ob, authors: oa}}
        ]
      )
      |> Repo.all()
      |> Repo.preload(:sources)
      |> Map.new(&{&1.id, &1})

    Enum.map(ids, &Map.fetch!(by_id, &1))
  end

  @doc """
  Preloads the countries, publishers, sources and translated book of a
  publication or a list of them, with the translated book's authors and
  original book, and the original book's authors.
  """
  def preload(data) do
    Repo.preload(data, [
      :countries,
      :publishers,
      :sources,
      translated_book: [:authors, original_book: [:authors]]
    ])
  end

  @doc """
  Inserts the publication `attrs` describes, and records it with a `created`
  history entry by `actor`, in one transaction.

  Returns `{:ok, publication}`, preloaded. Returns `{:error, errors}` when
  `attrs` is invalid, and `{:error, :conflict}` when a stored publication has
  the same composite key. It is `insert_all/2` with a batch of one.
  """
  def insert(attrs, actor \\ History.system_actor()) do
    case insert_all([attrs], actor) do
      {:ok, [publication]} -> {:ok, publication}
      {:error, {_attrs, errors}} -> {:error, errors}
    end
  end

  @doc """
  Applies `attrs` to the publication with the id `id` that is not deleted,
  and records the change with an `updated` history entry by `actor`, in one
  transaction. A save that changes nothing records no entry.

  Returns `{:ok, publication}`, preloaded. Returns `{:error, :not_found}` when
  there is no such publication, `{:error, errors}` when `attrs` is invalid,
  and `{:error, :conflict}` when another publication has the composite key the
  change would give it.
  """
  def update(id, attrs, actor \\ History.system_actor()) do
    case get(id, deleted: false) do
      nil ->
        {:error, :not_found}

      publication ->
        publication |> update_and_record(attrs, actor) |> refresh_if_changed()
    end
  end

  # Takes the result of `update_and_record/3`, signals the refresher when the
  # update changed the publication, and returns `{:ok, publication}` or the
  # error.
  defp refresh_if_changed({:ok, {updated, true}}) do
    Index.Refresher.refresh()
    {:ok, updated}
  end

  defp refresh_if_changed({:ok, {updated, false}}), do: {:ok, updated}
  defp refresh_if_changed(error), do: error

  # Applies `attrs` to `publication` and records the change, in one
  # transaction. Returns `{:ok, {publication, changed?}}`, where `changed?`
  # says whether the update changed the publication's snapshot, or
  # `{:error, :conflict}` when the change would give it another publication's
  # composite key, or `{:error, errors}` when `attrs` is invalid.
  #
  # The snapshots before and after decide whether anything changed, because
  # `cast_assoc(:sources)` replaces every source, so the changeset always has
  # changes.
  defp update_and_record(publication, attrs, actor) do
    publication = preload(publication)
    before = History.snapshot(publication)

    Repo.transaction(fn ->
      publication
      |> changeset(attrs)
      |> link_assocs()
      |> Repo.update()
      |> case do
        {:ok, updated} ->
          settle!()
          updated |> reloaded() |> record_if_changed(before, actor)

        {:error, changeset} ->
          Repo.rollback(Validation.get_errors(changeset))
      end
    end)
  end

  # Records an `updated` entry when the snapshot of `updated` differs from
  # `before`, and returns `{updated, changed?}`.
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
  Tombstones the publication with the id `id`, and records a `deleted` history
  entry by `actor`, in one transaction. Every read leaves the publication out
  afterwards, and `restore/3` can bring it back.

  Returns `{:ok, publication}`, or `{:error, :not_found}` when there is no
  such publication that is not deleted.
  """
  def delete(id, actor \\ History.system_actor()) do
    case get(id, deleted: false) do
      nil -> {:error, :not_found}
      publication -> stamp_deleted(publication, actor)
    end
  end

  @doc """
  Undoes the entry with the version `version` in the history of the
  publication with the id `id`, by applying the action that compensates it.
  The compensating action is recorded as a new entry by `actor`.

  Returns the result of that action. Returns `{:error, :not_found}` when there
  is no such entry, and `{:error, :conflict}` when the entry is not undoable
  (see `Publication.History.undoable?/3`).
  """
  def undo(id, version, actor \\ History.system_actor()) do
    stream = History.of(id)
    entry = Enum.find(stream, &(&1.version == version))

    cond do
      is_nil(entry) -> {:error, :not_found}
      not entry.undoable -> {:error, :conflict}
      true -> compensate(entry, previous_of(stream, entry), History.head(stream), actor)
    end
  end

  # Returns the entry before `entry` in `stream`, which holds the state an
  # update is reverted to, or nil for the publication's first entry.
  defp previous_of(stream, entry) do
    Enum.find(stream, &(&1.version < entry.version))
  end

  # Applies the action that compensates `entry`: a delete for an import or a
  # restore, a restore for a delete, the reverted snapshot for an update,
  # `unmerge/4` for a merge, and the merge again for an un-merge.
  defp compensate(%{action: action, publication_id: id}, _previous, _head, actor)
       when action in ["created", "restored"] do
    delete(id, actor)
  end

  # A restore that finds another publication with the composite key returns a
  # plain conflict.
  defp compensate(%{action: "deleted", publication_id: id}, _previous, _head, actor) do
    case restore(id, actor) do
      {:error, {:conflict, _twin}} -> {:error, :conflict}
      result -> result
    end
  end

  defp compensate(entry = %{action: "updated", publication_id: id}, previous, head, actor) do
    entry
    |> History.reverted_snapshot(previous, head)
    |> Codec.nest()
    |> then(&update(id, &1, actor))
  end

  defp compensate(entry = %{action: "merged"}, previous, head, actor) do
    unmerge(entry, previous, head, actor)
  end

  defp compensate(entry = %{action: "unmerged", publication_id: id}, _previous, _head, actor) do
    merge(id, History.other_ids(entry), actor)
  end

  # Undoes the merge `entry`, in one transaction: clears the tombstones of the
  # publications it absorbed, reverts the winner to its state before the
  # merge, and records one `unmerged` entry on the winner that names the
  # publications it gave back. An un-merge has the same shape as a merge, so it
  # can be undone in turn.
  defp unmerge(entry, previous, head, actor) do
    Repo.transaction(fn ->
      with {:ok, restored} <- restore_absorbed(History.other_ids(entry)),
           {:ok, winner} <- revert_winner(entry, previous, head) do
        settle!()
        winner = reloaded(winner)
        History.record(:unmerged, winner, actor, restored)
        winner
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
    |> tap(fn
      {:ok, _} -> Index.Refresher.refresh()
      _ -> :ok
    end)
  end

  # Clears `deleted_at` on the publications with the ids `ids` with one
  # statement, and returns them, preloaded. Returns `{:error, :not_found}` when
  # one of them is missing or not deleted. A publication brought back can have
  # the composite key of another, which `settle!/0` reports once the whole
  # un-merge is written.
  defp restore_absorbed(ids) do
    {count, _} =
      Ecto.Query.from(p in Publication, where: p.id in ^ids and not is_nil(p.deleted_at))
      |> Repo.update_all(set: [deleted_at: nil, updated_at: NaiveDateTime.utc_now(:second)])

    if count == length(ids), do: {:ok, with_ids(ids)}, else: {:error, :not_found}
  end

  # Writes the snapshot that undoing the merge `entry` gives the winner: its
  # current state with the fields the merge changed put back, as an undone
  # update does. Returns `{:error, :conflict}` when the merge has no previous
  # entry to revert to.
  defp revert_winner(_entry, nil, _head), do: {:error, :conflict}

  defp revert_winner(entry = %{publication_id: id}, previous, head) do
    entry
    |> History.reverted_snapshot(previous, head)
    |> Codec.nest()
    |> then(&(id |> get(deleted: false) |> preload() |> changeset(&1)))
    |> link_assocs()
    |> Repo.update()
    |> case do
      {:ok, winner} -> {:ok, winner}
      {:error, changeset} -> {:error, Validation.get_errors(changeset)}
    end
  end

  @doc """
  Merges the publications with the ids `loser_ids` into the one with the id
  `winner_id`, and records the merge with one `merged` entry by `actor` on the
  winner, in one transaction.

  The winner keeps its title, year, notes, translated book and original
  book. It gains the countries and publishers of the losers, and their sources
  after its own, leaving out a source it already holds. The losers are then
  tombstoned, and their distinctions from each other and from the winner are
  deleted (see `Publication.Duplicates.forget/1`). The entry names the losers, so `undo/3`
  can undo the whole merge.

  Returns `{:ok, winner}`, preloaded. Returns `{:error, :conflict}` when the
  merged publication would have the composite key of another publication,
  `{:error, :not_found}` when one of the publications is missing or deleted,
  `{:error, :self}` when `loser_ids` holds `winner_id`, and
  `{:error, :no_losers}` when `loser_ids` is empty.
  """
  def merge(winner_id, loser_ids, actor \\ History.system_actor())

  def merge(_winner_id, [], _actor), do: {:error, :no_losers}

  def merge(winner_id, loser_ids, actor) do
    with {:ok, winner, losers} <- assemble(winner_id, loser_ids),
         {:ok, merged} <- merge_and_record(winner, losers, actor) do
      Index.Refresher.refresh()
      {:ok, merged}
    end
  end

  # Returns `{:ok, winner, losers}`, preloaded, or `{:error, :self}` when the
  # losers include the winner. Ids are compared as strings, so an id given as a
  # string matches the same id given as an integer.
  defp assemble(winner_id, loser_ids) do
    loser_ids = loser_ids |> Enum.map(&to_string/1) |> Enum.uniq()

    if to_string(winner_id) in loser_ids,
      do: {:error, :self},
      else: gathered([winner_id | loser_ids])
  end

  # Reads the publications with the ids `ids` that are not deleted, preloaded,
  # with one query, and returns `{:ok, first, rest}` in the order of `ids`.
  # Returns `{:error, :not_found}` when one of them is missing.
  defp gathered(ids) do
    by_id =
      Ecto.Query.from(p in Publication, where: p.id in ^ids and is_nil(p.deleted_at))
      |> Repo.all()
      |> preload()
      |> Map.new(&{to_string(&1.id), &1})

    publications = Enum.map(ids, &Map.get(by_id, to_string(&1)))

    if Enum.any?(publications, &is_nil/1) do
      {:error, :not_found}
    else
      [winner | losers] = publications
      {:ok, winner, losers}
    end
  end

  # Writes the merge and records it, in one transaction.
  defp merge_and_record(winner, losers, actor) do
    attrs = reconciled(winner, losers)

    Repo.transaction(fn ->
      winner
      |> changeset(attrs)
      |> link_assocs()
      |> Repo.update()
      |> case do
        {:ok, updated} -> absorbing(updated, losers, actor)
        {:error, changeset} -> Repo.rollback(Validation.get_errors(changeset))
      end
    end)
  end

  # Tombstones the losers, records the one `merged` entry on the winner, and
  # deletes the distinctions among the merged publications. The losers get no
  # entry of their own, so the merge is undone as a whole from the winner's
  # history.
  #
  # The keys are checked once the losers are tombstoned, so the winner may
  # take on a key one of its own losers held.
  defp absorbing(winner, losers, actor) do
    ids = Enum.map(losers, & &1.id)

    Ecto.Query.from(p in Publication, where: p.id in ^ids)
    |> Repo.update_all(
      set: [deleted_at: DateTime.utc_now(:second), updated_at: NaiveDateTime.utc_now(:second)]
    )

    settle!()
    winner = reloaded(winner)
    History.record(:merged, winner, actor, losers)
    Duplicates.forget([winner.id | ids])

    winner
  end

  # Builds the change that sets or clears `deleted_at`. Clearing it brings the
  # publication back under the composite key, so the caller settles the keys
  # afterwards, and a publication written with the same key meanwhile is a
  # conflict.
  defp tombstone(publication, deleted_at) do
    change(publication, deleted_at: deleted_at)
  end

  # Returns the nested attrs of the merged publication: the winner's fields,
  # the countries and publishers of all of them, and the sources of all of
  # them, each listed once.
  defp reconciled(winner, losers) do
    flat = Enum.map([winner | losers], &History.snapshot/1)
    [kept | _] = flat

    kept
    |> Map.delete(:id)
    |> Map.merge(%{
      countries: union_of(flat, :countries),
      publishers: union_of(flat, :publishers),
      sources: flat |> Enum.flat_map(& &1.sources) |> Enum.uniq()
    })
    |> Codec.nest()
  end

  # Returns the values of the list field `field` across the snapshots `flat`,
  # each once, sorted.
  defp union_of(flat, field) do
    flat
    |> Enum.flat_map(&(Map.get(&1, field) || []))
    |> Enum.uniq()
    |> Enum.sort()
  end

  @doc """
  Brings back the deleted publication with the id `id`, and records a
  `restored` history entry by `actor`, in one transaction. When `changes` are
  given, they are applied to the publication first, in the same transaction,
  and recorded as an update before the restore.

  Returns `{:ok, publication}`. Returns `{:error, :not_found}` when there is no
  such deleted publication, and `{:error, :absorbed}` when the publication is
  absorbed, which only undoing the merge brings back.

  When a publication that is not deleted has the same composite key, which
  happens when the same publication was imported again or a name was
  corrected to match, the result is `{:error, {:conflict, twin}}`, where
  `twin` is that publication. Nothing is written then, not even the changes.
  Changes that do not validate return their errors and write nothing either.
  """
  def restore(id, actor \\ History.system_actor(), changes \\ nil) do
    with {:ok, publication} <- deleted_on_its_own(id) do
      Repo.transaction(fn ->
        publication
        |> amend(changes, actor)
        |> lift(actor)
      end)
      |> case do
        {:ok, restored} ->
          Index.Refresher.refresh()
          {:ok, restored}

        error ->
          error
      end
    end
  end

  # Applies `changes` to a deleted publication and records them as an update.
  # Without changes, returns the publication as it is. Rolls back with the
  # errors when the changes do not validate.
  defp amend(publication, nil, _actor), do: publication

  defp amend(publication, changes, actor) do
    case update_and_record(publication, changes, actor) do
      {:ok, {amended, _changed?}} -> amended
      {:error, reason} -> Repo.rollback(reason)
    end
  end

  # Clears `deleted_at` and records the restore. Rolls back with
  # `{:conflict, twin}` when another publication that is not deleted has the
  # same composite key, where `twin` is that publication, preloaded.
  defp lift(publication, actor) do
    publication = preload(publication)
    publication |> tombstone(nil) |> Repo.update!()

    case Identity.settle() do
      :ok ->
        History.record(:restored, publication, actor)
        publication

      {:error, :conflict} ->
        Repo.rollback({:conflict, twin(publication)})
    end
  end

  # Returns the publication that is not deleted and has the same composite key
  # as `publication`, preloaded.
  defp twin(publication) do
    [id] = Identity.publications_with_keys([Codec.flatten(publication)], publication.id)
    hd(with_ids([id]))
  end

  # Returns `{:ok, publication}` for the deleted publication with the id `id`,
  # `{:error, :absorbed}` when a merge absorbed it, and `{:error, :not_found}`
  # when there is no such deleted publication.
  defp deleted_on_its_own(id) do
    publication = get(id, deleted: true)

    cond do
      is_nil(publication) -> {:error, :not_found}
      MapSet.member?(History.absorbed([publication.id]), publication.id) -> {:error, :absorbed}
      true -> {:ok, publication}
    end
  end

  # Tombstones `publication` and records a `deleted` entry by `actor`, in one
  # transaction, then signals the refresher.
  defp stamp_deleted(publication, actor) do
    publication = preload(publication)

    result =
      Repo.transaction(fn ->
        publication
        |> tombstone(DateTime.utc_now(:second))
        |> Repo.update()
        |> case do
          {:ok, _} ->
            settle!()
            History.record(:deleted, publication, actor)

          {:error, changeset} ->
            Repo.rollback(Validation.get_errors(changeset))
        end
      end)

    case result do
      {:ok, _} ->
        Index.Refresher.refresh()
        {:ok, publication}

      error ->
        error
    end
  end

  @doc """
  Returns the publications someone deleted, preloaded, the most recently
  deleted first. The absorbed publications are left out: nobody deleted them,
  and only undoing the merge brings them back.
  """
  def all_deleted do
    deleted =
      Ecto.Query.from(p in Publication,
        where: not is_nil(p.deleted_at),
        order_by: [desc: p.deleted_at]
      )
      |> Repo.all()

    absorbed = History.absorbed(Enum.map(deleted, & &1.id))

    deleted
    |> Enum.reject(&MapSet.member?(absorbed, &1.id))
    |> preload()
  end

  @doc """
  Returns the publication with the id `id`, preloaded, or `nil` when there is
  none or it is deleted.
  """
  def find(id) do
    case get(id, deleted: false) do
      nil -> nil
      publication -> preload(publication)
    end
  end

  # Returns the publication with the id `id`, among the ones that are not
  # deleted or among the deleted ones, or nil.
  defp get(id, deleted: false) do
    Repo.one(Ecto.Query.from(p in Publication, where: p.id == ^id and is_nil(p.deleted_at)))
  end

  defp get(id, deleted: true) do
    Repo.one(Ecto.Query.from(p in Publication, where: p.id == ^id and not is_nil(p.deleted_at)))
  end

  # Reads `publication` back from the database, preloaded. The struct a write
  # returns holds the fingerprints as they were before its links were saved,
  # the translated book it had before `link_assocs/1` pointed it at another,
  # and its names in the order the write gave them.
  defp reloaded(publication), do: hd(with_ids([publication.id]))

  # Checks the composite keys inside the current transaction, and rolls it back
  # with `:conflict` when a write gave a publication or a book the same key as
  # another.
  defp settle! do
    with {:error, :conflict} <- Identity.settle(), do: Repo.rollback(:conflict)
  end

  # Points a valid changeset's translated book, countries and publishers at
  # the stored rows it names, which `Publication.Links` finds or inserts, so a
  # publication reuses countries, books and publishers rather than duplicating
  # them. Returns an invalid changeset unchanged.
  defp link_assocs(changeset = %Ecto.Changeset{valid?: true}) do
    [links] = Links.resolve([apply_changes(changeset)])

    changeset
    |> delete_change(:translated_book)
    |> put_change(:translated_book_id, links.translated_book_id)
    |> put_assoc(:countries, links.countries)
    |> put_assoc(:publishers, links.publishers)
  end

  defp link_assocs(changeset), do: changeset

  @doc """
  Inserts the publications `attrs_list` describes in one transaction, all or
  none, records each with a `created` history entry by `actor`, and signals
  the refresher once. See `Publication.Import.insert_all/2` for what it
  returns.
  """
  def insert_all(attrs_list, actor \\ History.system_actor()) do
    with {:ok, _publications} = result <- Import.insert_all(attrs_list, actor) do
      Index.Refresher.refresh()
      result
    end
  end
end
