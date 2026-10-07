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
  once, after every row is written, inside a savepoint. After a conflict, the
  transaction rolls back to the savepoint, so the rows can still be read to
  find the first one in conflict.
  """

  import Ecto.Query, only: [from: 2]

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
    now = NaiveDateTime.utc_now(:second)
    entries = Enum.map(rows, fn {_attrs, changeset} -> Changeset.apply_changes(changeset) end)
    links = Links.resolve(entries)
    publication_ids = insert_publications(entries, links, now)

    [rows, publication_ids, links]
    |> Enum.zip_with(fn [{attrs, _changeset}, publication_id, links] ->
      %{
        attrs: attrs,
        publication_id: publication_id,
        translated_book_id: links.translated_book_id,
        original_book_id: links.original_book_id
      }
    end)
    |> settle!()

    publications = load(publication_ids)
    History.record_all(:created, publications, actor)
    publications
  end

  # Inserts a publication for each entry, with its links to the countries and
  # publishers in `links`, and its sources. Returns the publications' ids in
  # order.
  defp insert_publications(entries, links, now) do
    ids =
      Publication
      |> Repo.insert_in_chunks(
        Enum.zip_with(entries, links, fn entry, links ->
          timestamped(
            %{title: entry.title, year: entry.year, translated_book_id: links.translated_book_id},
            now
          )
        end),
        returning: [:id]
      )
      |> Enum.map(& &1.id)

    published = Enum.zip([ids, entries, links])

    country_links =
      for {id, _entry, links} <- published,
          country <- links.countries,
          do: %{publication_id: id, country_id: country.id}

    publisher_links =
      for {id, _entry, links} <- published,
          publisher <- links.publishers,
          do: %{publication_id: id, publisher_id: publisher.id}

    sources =
      for {id, entry, _links} <- published,
          source <- sources(entry),
          do:
            timestamped(
              %{publication_id: id, content: source.content, position: source.position},
              now
            )

    Repo.insert_in_chunks("publication_countries", country_links)
    Repo.insert_in_chunks("publication_publishers", publisher_links)
    Repo.insert_in_chunks(Source, sources)

    ids
  end

  # Checks the composite keys. When a row has the same key as another row or a
  # stored publication, rolls the transaction back with the first such row's
  # attrs and `:conflict`. Each of `rows` holds a row's attrs and the ids of its
  # publication and books.
  defp settle!(rows) do
    Repo.query!("SAVEPOINT import_settle")

    with {:error, :conflict} <- Identity.settle() do
      Repo.query!("ROLLBACK TO SAVEPOINT import_settle")
      Repo.rollback({first_in_conflict(rows), :conflict})
    end
  end

  # Returns the attrs of the first of `rows` whose publication, translated book
  # or original book has the same key as another.
  defp first_in_conflict(rows) do
    publications = in_conflict(rows, :publication_id, &Identity.publications_in_conflict/1)

    translated_books =
      in_conflict(rows, :translated_book_id, &Identity.translated_books_in_conflict/1)

    original_books = in_conflict(rows, :original_book_id, &Identity.original_books_in_conflict/1)

    %{attrs: attrs} =
      Enum.find(rows, fn row ->
        row.publication_id in publications or row.translated_book_id in translated_books or
          row.original_book_id in original_books
      end)

    attrs
  end

  # Returns the ids under `key` in `rows` that `find` reports in conflict.
  defp in_conflict(rows, key, find) do
    rows |> Enum.map(&Map.fetch!(&1, key)) |> Enum.uniq() |> find.() |> MapSet.new()
  end

  # Reads back the publications with the ids `ids`, preloaded, in order.
  defp load(ids) do
    stored =
      from(p in Publication, where: p.id in ^ids)
      |> Repo.all()
      |> Publication.preload()
      |> Map.new(&{&1.id, &1})

    Enum.map(ids, &Map.fetch!(stored, &1))
  end

  # Returns an entry's sources, or an empty list when its row gave none.
  defp sources(%{sources: sources}) when is_list(sources), do: sources
  defp sources(_entry), do: []

  # Returns `columns` with the timestamps of a row inserted at `now`.
  defp timestamped(columns, now), do: Map.merge(columns, %{inserted_at: now, updated_at: now})
end
