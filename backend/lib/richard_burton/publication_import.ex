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

  A *row* is one entry of the batch, cast with `Publication.changeset/2`. A
  *book key* identifies a book within the batch the way
  `RichardBurton.Identity` identifies it in the database. The key of an
  original book is its title and its authors' names, and the key of a
  translated book is its original book's id and its translators' names. The
  names are sorted, so the same names in another order give the same key.

  The work goes table by table rather than row by row. The names that the rows
  use are looked up with one query per table, and the missing ones are inserted
  with one more. The books are found and inserted the same way, and then the
  publications, their links, their sources and their history entries. The
  composite keys are checked once, after every row is written, inside a
  savepoint. After a conflict, the transaction rolls back to the savepoint, so
  the rows can still be read to find the first one in conflict.
  """

  import Ecto.Query, only: [from: 2]

  alias Ecto.Changeset
  alias RichardBurton.Author
  alias RichardBurton.Country
  alias RichardBurton.Identity
  alias RichardBurton.OriginalBook
  alias RichardBurton.Publication
  alias RichardBurton.Publication.History
  alias RichardBurton.Publisher
  alias RichardBurton.Repo
  alias RichardBurton.Source
  alias RichardBurton.TranslatedBook
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

    names =
      for entry <- entries,
          book <- [entry.translated_book.original_book, entry.translated_book],
          author <- book.authors,
          do: author.name

    authors = ids_by(Author, :name, names, now)

    original_book_ids = original_book_ids(entries, authors, now)
    translated_book_ids = translated_book_ids(entries, original_book_ids, authors, now)

    publication_ids = insert_publications(entries, translated_book_ids, now)

    [rows, publication_ids, translated_book_ids, original_book_ids]
    |> Enum.zip_with(fn [{attrs, _}, publication_id, translated_book_id, original_book_id] ->
      %{
        attrs: attrs,
        publication_id: publication_id,
        translated_book_id: translated_book_id,
        original_book_id: original_book_id
      }
    end)
    |> settle!()

    publications = load(publication_ids)

    History.record_all(:created, publications, actor)
    publications
  end

  # Returns a map from each of `values` to the id of the row of `schema` whose
  # `column` holds it, and inserts the rows that are missing. `columns` gives
  # the other columns of a new row from its value.
  #
  # Another transaction can store a value between the lookup and the insert.
  # The insert then waits for that transaction to finish, skips the value once
  # it has committed, and the row it stored is read instead.
  defp ids_by(schema, column, values, now, columns \\ fn _value -> %{} end) do
    values = Enum.uniq(values)
    stored = stored_ids(schema, column, values)
    missing = Enum.reject(values, &Map.has_key?(stored, &1))

    inserted =
      schema
      |> Repo.insert_in_chunks(
        Enum.map(missing, &Map.merge(columns.(&1), timestamped(%{column => &1}, now))),
        on_conflict: :nothing,
        conflict_target: column,
        returning: [:id, column]
      )
      |> Map.new(&{Map.fetch!(&1, column), &1.id})

    taken = Enum.reject(missing, &Map.has_key?(inserted, &1))

    stored |> Map.merge(inserted) |> Map.merge(stored_ids(schema, column, taken))
  end

  # Returns a map from each of `values` that a row of `schema` holds in
  # `column` to that row's id.
  defp stored_ids(_schema, _column, []), do: %{}

  defp stored_ids(schema, column, values) do
    from(r in schema, where: field(r, ^column) in ^values, select: {field(r, ^column), r.id})
    |> Repo.all()
    |> Map.new()
  end

  # Returns the id of each entry's original book, in order, and inserts the
  # books that are not stored, linked to their authors.
  defp original_book_ids(entries, authors, now) do
    keyed =
      Enum.map(entries, fn entry ->
        book = entry.translated_book.original_book
        {{book.title, names(book.authors)}, book}
      end)

    ids =
      ids_by_key(keyed, &Identity.original_books_with_keys/1, fn missing ->
        insert_books(
          OriginalBook,
          missing,
          fn {{title, _names}, _book} -> %{title: title} end,
          {"original_book_authors", :original_book_id},
          authors,
          now
        )
      end)

    Enum.map(keyed, fn {key, _book} -> Map.fetch!(ids, key) end)
  end

  # Returns the id of each entry's translated book, in order, and inserts the
  # books that are not stored, linked to their translators.
  defp translated_book_ids(entries, original_book_ids, authors, now) do
    keyed =
      Enum.zip_with(entries, original_book_ids, fn entry, original_book_id ->
        book = entry.translated_book
        {{original_book_id, names(book.authors)}, book}
      end)

    ids =
      ids_by_key(keyed, &Identity.translated_books_with_keys/1, fn missing ->
        insert_books(
          TranslatedBook,
          missing,
          fn {{original_book_id, _names}, _book} -> %{original_book_id: original_book_id} end,
          {"translated_book_authors", :translated_book_id},
          authors,
          now
        )
      end)

    Enum.map(keyed, fn {key, _book} -> Map.fetch!(ids, key) end)
  end

  # Returns a map from each book key in `keyed` to the id of its book.
  #
  # `keyed` pairs each book with its key. `find` takes the distinct keys and
  # returns the stored id of each, or nil. `insert` takes the keys `find`
  # returns nil for, each paired with the first book that has it, inserts the
  # books, and returns their ids in order.
  defp ids_by_key(keyed, find, insert) do
    distinct = Enum.uniq_by(keyed, fn {key, _book} -> key end)
    found = Enum.zip(distinct, find.(Enum.map(distinct, fn {key, _book} -> key end)))
    missing = for {pair, nil} <- found, do: pair
    stored = for {{key, _book}, id} <- found, id != nil, into: %{}, do: {key, id}

    missing
    |> Enum.map(fn {key, _book} -> key end)
    |> Enum.zip(insert.(missing))
    |> Map.new()
    |> Map.merge(stored)
  end

  # Inserts a book of `schema` for each `{key, book}` in `missing`, with the
  # columns that `columns` gives for the pair. Links each book to its authors
  # through a join table, given with the column that names the book in it.
  # `authors` maps each author's name to its id. Returns the ids of the new
  # books in order.
  defp insert_books(schema, missing, columns, {link_table, book_column}, authors, now) do
    ids =
      schema
      |> Repo.insert_in_chunks(Enum.map(missing, &timestamped(columns.(&1), now)),
        returning: [:id]
      )
      |> Enum.map(& &1.id)

    links =
      for {{_key, book}, id} <- Enum.zip(missing, ids),
          author <- book.authors,
          do: %{book_column => id, author_id: Map.fetch!(authors, author.name)}

    Repo.insert_in_chunks(link_table, links)
    ids
  end

  # Inserts a publication for each entry, with its links to its countries and
  # publishers, and its sources. Returns the publications' ids in order.
  defp insert_publications(entries, translated_book_ids, now) do
    ids =
      Publication
      |> Repo.insert_in_chunks(
        Enum.zip_with(entries, translated_book_ids, fn entry, translated_book_id ->
          timestamped(
            %{title: entry.title, year: entry.year, translated_book_id: translated_book_id},
            now
          )
        end),
        returning: [:id]
      )
      |> Enum.map(& &1.id)

    countries = ids_by(Country, :code, codes(entries), now, &%{names: Country.names_for(&1)})
    publishers = ids_by(Publisher, :name, publisher_names(entries), now)
    published = Enum.zip(ids, entries)

    country_links =
      for {id, entry} <- published,
          country <- entry.countries,
          do: %{publication_id: id, country_id: Map.fetch!(countries, country.code)}

    publisher_links =
      for {id, entry} <- published,
          publisher <- entry.publishers,
          do: %{publication_id: id, publisher_id: Map.fetch!(publishers, publisher.name)}

    sources =
      for {id, entry} <- published,
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

  # Returns the names of `authors`, sorted, as a book key holds them.
  defp names(authors), do: authors |> Enum.map(& &1.name) |> Enum.sort()

  # Returns the country codes of every entry, in order.
  defp codes(entries), do: for(entry <- entries, country <- entry.countries, do: country.code)

  # Returns the publishers' names of every entry, in order.
  defp publisher_names(entries),
    do: for(entry <- entries, publisher <- entry.publishers, do: publisher.name)

  # Returns an entry's sources, or an empty list when its row gave none.
  defp sources(%{sources: sources}) when is_list(sources), do: sources
  defp sources(_entry), do: []

  # Returns `columns` with the timestamps of a row inserted at `now`.
  defp timestamped(columns, now), do: Map.merge(columns, %{inserted_at: now, updated_at: now})
end
