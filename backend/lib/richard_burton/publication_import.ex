defmodule RichardBurton.Publication.Import do
  @moduledoc """
  Inserts a batch of new publications in one transaction, with a number of
  queries that does not depend on the number of rows.

  The batch is stored as its rows would be if each were imported alone, one
  after another. A row links to the stored countries, publishers, authors and
  books it names, and to those an earlier row of the batch stored, and each
  publication is recorded in the history with a `created` entry. When a row is
  invalid, or has the same composite key as a stored publication or an earlier
  row, nothing is stored.

  A *row* is one entry of the batch, cast with `Publication.changeset/2`.

  `Publication.Links` finds or inserts the names and books that the rows use.
  The publications, their links, their sources and their history entries are
  then inserted with one statement per table. The composite keys are checked
  once, after every row is written, with `Identity.settle/0`. A conflict leaves
  the transaction usable, so the rows can still be read to find the first one
  in conflict.
  """

  alias Ecto.Changeset
  alias RichardBurton.Identity
  alias RichardBurton.Publication
  alias RichardBurton.Publication.History
  alias RichardBurton.Publication.Links
  alias RichardBurton.Repo
  alias RichardBurton.Source
  alias RichardBurton.Validation

  @doc """
  Inserts the publications that `attrs_list` describes, and records `actor` as
  the author of each one's `created` history entry.

  Returns `{:ok, publications}` in the order of `attrs_list`, each preloaded
  with `Publication.preload/1`.

  Returns `{:error, {attrs, errors}}` for the first invalid row, where
  `errors` is what `Validation.get_errors/1` returns for it, before anything is
  written. When every row is valid, returns `{:error, {attrs, :conflict}}` for
  the first row with the same composite key as a stored publication or an
  earlier row.
  """
  @spec insert_all([map()], String.t()) ::
          {:ok, [Ecto.Schema.t()]} | {:error, {map(), atom() | map()}}
  def insert_all(attrs_list, actor) do
    rows = Enum.map(attrs_list, &{&1, Publication.changeset(%Publication{}, &1)})

    case Enum.find(rows, fn {_attrs, changeset} -> not changeset.valid? end) do
      nil -> Repo.transaction(fn -> insert(rows, actor) end)
      {attrs, changeset} -> {:error, {attrs, Validation.get_errors(changeset)}}
    end
  end

  # Writes `rows`, which are all valid, and their history entries, and returns
  # the stored publications. Rolls the transaction back with the first row in
  # conflict.
  defp insert([], _actor), do: []

  defp insert(rows, actor) do
    {attrs_list, changesets} = Enum.unzip(rows)
    links = changesets |> Enum.map(&Changeset.apply_changes/1) |> Links.resolve()
    ids = insert_publications(changesets, links)

    settle!(attrs_list, ids)

    publications = Publication.with_ids(ids)
    History.record_created(publications, actor)
    publications
  end

  # Inserts a publication for each changeset, with its links to the countries
  # and publishers in `links`, and its sources. The columns of each row are the
  # changes the changeset casts. Returns the publications' ids in order.
  defp insert_publications(changesets, links) do
    ids =
      Publication
      |> Repo.insert_in_chunks(
        Enum.zip_with(changesets, links, fn changeset, links ->
          changeset.changes
          |> Map.drop(Publication.__schema__(:associations))
          |> Map.put(:translated_book_id, links.translated_book_id)
        end),
        returning: [:id]
      )
      |> Enum.map(& &1.id)

    published = Enum.zip([ids, changesets, links])

    country_links =
      for {id, _changeset, links} <- published,
          country <- links.countries,
          do: %{publication_id: id, country_id: country.id}

    publisher_links =
      for {id, _changeset, links} <- published,
          publisher <- links.publishers,
          do: %{publication_id: id, publisher_id: publisher.id}

    sources =
      for {id, changeset, _links} <- published,
          source <- Changeset.get_change(changeset, :sources, []),
          do: Map.put(source.changes, :publication_id, id)

    Repo.insert_in_chunks("publication_countries", country_links)
    Repo.insert_in_chunks("publication_publishers", publisher_links)
    Repo.insert_in_chunks(Source, sources)

    ids
  end

  # Checks the composite keys of the publications with the ids `ids`, inserted
  # from `attrs_list` in the same order. When one of them, or one of its books,
  # has the same key as another, rolls the transaction back with the first such
  # publication's attrs and `:conflict`.
  defp settle!(attrs_list, ids) do
    with {:error, :conflict} <- Identity.settle() do
      conflicted = MapSet.new(Identity.publications_in_conflict(ids))

      {attrs, _id} =
        attrs_list |> Enum.zip(ids) |> Enum.find(fn {_attrs, id} -> id in conflicted end)

      Repo.rollback({attrs, :conflict})
    end
  end
end
