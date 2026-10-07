defmodule RichardBurton.Publication.Links do
  @moduledoc """
  Finds the stored rows that publications link to, and inserts the ones that
  are missing: their countries, their publishers, and their translated books,
  with the original books and authors those link to. It works on a list of
  publications at once, with a number of queries that does not depend on the
  length of the list.

  An *entry* is a publication as `Ecto.Changeset.apply_changes/1` returns it
  from a valid `Publication.changeset/2`. It holds names, but no ids.

  An original book is identified by its title and its authors' names, and a
  translated book by its original book and its translators' names, as
  `RichardBurton.Identity` describes. An entry's *book key* holds its original
  title, its original authors' names and its translators' names, with the
  names sorted. So the same names in another order give the same key, and
  entries with the same key share one original book and one translated book.

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
  The stored rows one entry links to: the id of its translated book, and its
  countries and publishers, loaded, in the order the entry lists them.
  """
  @type t :: %{
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
    authors = rows_by(Author, :name, Enum.flat_map(entries, &author_names/1))
    translated_book_ids = book_ids(Enum.map(entries, &book_key/1), authors)

    countries =
      rows_by(
        Country,
        :code,
        Enum.flat_map(entries, &Country.flatten(&1.countries)),
        &%{names: Country.names_for(&1)}
      )

    publishers =
      rows_by(Publisher, :name, Enum.flat_map(entries, &Publisher.flatten(&1.publishers)))

    Enum.zip_with(entries, translated_book_ids, fn entry, translated_book_id ->
      %{
        translated_book_id: translated_book_id,
        countries: Enum.map(entry.countries, &Map.fetch!(countries, &1.code)),
        publishers: Enum.map(entry.publishers, &Map.fetch!(publishers, &1.name))
      }
    end)
  end

  # Returns a map from each of `values` to the row of `schema` whose `column`
  # holds it, and inserts the rows that are missing. `columns` gives the other
  # columns of a new row from its value.
  defp rows_by(schema, column, values, columns \\ fn _value -> %{} end) do
    values = Enum.uniq(values)
    stored = stored_rows(schema, column, values)
    missing = Enum.reject(values, &Map.has_key?(stored, &1))

    inserted =
      schema
      |> Repo.insert_in_chunks(
        Enum.map(missing, &Map.put(columns.(&1), column, &1)),
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

  # Returns the id of the translated book each of `keys` names, in order, and
  # inserts the original and translated books that are not stored, linked to
  # their authors. `authors` maps each author's name to its row.
  defp book_ids(keys, authors) do
    distinct = Enum.uniq(keys)
    found = Enum.zip(distinct, Identity.books_with_keys(distinct))

    stored_originals =
      for {{title, names, _translators}, {id, _}} <- found,
          id,
          into: %{},
          do: {{title, names}, id}

    originals =
      distinct
      |> Enum.map(fn {title, names, _translators} -> {title, names} end)
      |> Enum.uniq()
      |> Enum.reject(&Map.has_key?(stored_originals, &1))
      |> insert_books(OriginalBook, :title, {"original_book_authors", :original_book_id}, authors)
      |> Map.merge(stored_originals)

    # A translated book's key: the id of its original book, and its
    # translators' names.
    translation = fn {title, names, translators} ->
      {Map.fetch!(originals, {title, names}), translators}
    end

    stored_translations =
      for {key, {_, id}} <- found, id, into: %{}, do: {translation.(key), id}

    translations =
      distinct
      |> Enum.map(translation)
      |> Enum.reject(&Map.has_key?(stored_translations, &1))
      |> insert_books(
        TranslatedBook,
        :original_book_id,
        {"translated_book_authors", :translated_book_id},
        authors
      )
      |> Map.merge(stored_translations)

    Enum.map(keys, &Map.fetch!(translations, translation.(&1)))
  end

  # Inserts a book of `schema` for each `{value, names}` in `keys`, holding
  # `value` in `column`, and links it to the authors named `names` through a
  # join table, given with the column that names the book in it. `authors` maps
  # each name to its row. Returns a map from each key to its new book's id.
  defp insert_books(keys, schema, column, {link_table, book_column}, authors) do
    ids =
      schema
      |> Repo.insert_in_chunks(
        Enum.map(keys, fn {value, _names} -> %{column => value} end),
        returning: [:id]
      )
      |> Enum.map(& &1.id)

    links =
      for {{_value, names}, id} <- Enum.zip(keys, ids),
          name <- names,
          do: %{book_column => id, author_id: Map.fetch!(authors, name).id}

    Repo.insert_in_chunks(link_table, links)
    keys |> Enum.zip(ids) |> Map.new()
  end

  # Returns the names of an entry's original authors and translators.
  defp author_names(entry) do
    book = entry.translated_book
    Author.flatten(book.original_book.authors) ++ Author.flatten(book.authors)
  end

  # Returns an entry's book key.
  defp book_key(entry) do
    book = entry.translated_book

    {book.original_book.title, sorted_names(book.original_book.authors),
     sorted_names(book.authors)}
  end

  # Returns the names of `authors`, sorted.
  defp sorted_names(authors), do: authors |> Author.flatten() |> Enum.sort()
end
