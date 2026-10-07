defmodule RichardBurton.Publication.Links do
  @moduledoc """
  Finds the stored rows that publications link to, and inserts the ones that
  are missing: their countries, their publishers, and their translated books,
  with the original books and authors those link to. It works on a list of
  publications at once, with a number of queries that does not depend on the
  length of the list.

  An *entry* is a publication as `Ecto.Changeset.apply_changes/1` returns it
  from a valid `Publication.changeset/2`. It holds names, but no ids.

  A *book key* identifies a book among the entries the way
  `RichardBurton.Identity` identifies it in the database. The key of an
  original book is its title and its authors' names, and the key of a
  translated book is its original book's id and its translators' names. The
  names are sorted, so the same names in another order give the same key, and
  entries with the same key share one book.

  Another transaction can insert the same name at the same time. The insert
  here then waits for that transaction to finish, skips the name once it has
  committed, and reads the row it stored instead. Two transactions that insert
  the same book are left to the composite keys, which refuse the second when
  they are checked.
  """

  import Ecto.Query, only: [from: 2]

  alias RichardBurton.Author
  alias RichardBurton.Country
  alias RichardBurton.Identity
  alias RichardBurton.OriginalBook
  alias RichardBurton.Publisher
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook

  @typedoc """
  The stored rows one entry links to: the ids of its original and translated
  books, and its countries and publishers, loaded, in the order the entry
  lists them.
  """
  @type t :: %{
          original_book_id: pos_integer(),
          translated_book_id: pos_integer(),
          countries: [Ecto.Schema.t()],
          publishers: [Ecto.Schema.t()]
        }

  @doc """
  Returns the stored rows each of `entries` links to, in the order of
  `entries`, and inserts the ones that are missing, inside the caller's
  transaction.
  """
  @spec resolve([Ecto.Schema.t()]) :: [t()]
  def resolve(entries) do
    now = NaiveDateTime.utc_now(:second)

    names =
      for entry <- entries,
          book <- [entry.translated_book.original_book, entry.translated_book],
          author <- book.authors,
          do: author.name

    authors = rows_by(Author, :name, names, now)
    original_book_ids = original_book_ids(entries, authors, now)
    translated_book_ids = translated_book_ids(entries, original_book_ids, authors, now)

    countries =
      rows_by(Country, :code, codes(entries), now, &%{names: Country.names_for(&1)})

    publishers = rows_by(Publisher, :name, publisher_names(entries), now)

    Enum.zip_with(
      [entries, original_book_ids, translated_book_ids],
      fn [entry, original_book_id, translated_book_id] ->
        %{
          original_book_id: original_book_id,
          translated_book_id: translated_book_id,
          countries: Enum.map(entry.countries, &Map.fetch!(countries, &1.code)),
          publishers: Enum.map(entry.publishers, &Map.fetch!(publishers, &1.name))
        }
      end
    )
  end

  # Returns a map from each of `values` to the row of `schema` whose `column`
  # holds it, and inserts the rows that are missing. `columns` gives the other
  # columns of a new row from its value.
  defp rows_by(schema, column, values, now, columns \\ fn _value -> %{} end) do
    values = Enum.uniq(values)
    stored = stored_rows(schema, column, values)
    missing = Enum.reject(values, &Map.has_key?(stored, &1))

    inserted =
      schema
      |> Repo.insert_in_chunks(
        Enum.map(missing, &Map.merge(columns.(&1), timestamped(%{column => &1}, now))),
        on_conflict: :nothing,
        conflict_target: column,
        returning: true
      )
      |> Map.new(&{Map.fetch!(&1, column), &1})

    taken = Enum.reject(missing, &Map.has_key?(inserted, &1))

    stored |> Map.merge(inserted) |> Map.merge(stored_rows(schema, column, taken))
  end

  # Returns a map from each of `values` that a row of `schema` holds in
  # `column` to that row.
  defp stored_rows(_schema, _column, []), do: %{}

  defp stored_rows(schema, column, values) do
    from(r in schema, where: field(r, ^column) in ^values)
    |> Repo.all()
    |> Map.new(&{Map.fetch!(&1, column), &1})
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
  # `authors` maps each author's name to its row. Returns the ids of the new
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
          do: %{book_column => id, author_id: Map.fetch!(authors, author.name).id}

    Repo.insert_in_chunks(link_table, links)
    ids
  end

  # Returns the names of `authors`, sorted, as a book key holds them.
  defp names(authors), do: authors |> Enum.map(& &1.name) |> Enum.sort()

  # Returns the country codes of every entry, in order.
  defp codes(entries), do: for(entry <- entries, country <- entry.countries, do: country.code)

  # Returns the publishers' names of every entry, in order.
  defp publisher_names(entries),
    do: for(entry <- entries, publisher <- entry.publishers, do: publisher.name)

  # Returns `columns` with the timestamps of a row inserted at `now`.
  defp timestamped(columns, now), do: Map.merge(columns, %{inserted_at: now, updated_at: now})
end
