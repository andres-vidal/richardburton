defmodule RichardBurton.Publication.Codec do
  @moduledoc """
  Serialization and deserialization utilities for publications
  """

  alias RichardBurton.Author
  alias RichardBurton.Codec
  alias RichardBurton.Country
  alias RichardBurton.Util
  alias RichardBurton.Publication
  alias RichardBurton.Publisher
  alias RichardBurton.Source
  alias RichardBurton.FlatPublication

  @empty_flat_attrs %{
    "title" => "",
    "year" => "",
    "countries" => "",
    "publishers" => "",
    "authors" => "",
    "original_title" => "",
    "original_authors" => ""
  }

  # The columns a file may carry, by the name its header gives them. Singular
  # names are accepted because a spreadsheet writes what a person would.
  @csv_columns %{
    "title" => "title",
    "year" => "year",
    "country" => "countries",
    "countries" => "countries",
    "publisher" => "publishers",
    "publishers" => "publishers",
    "authors" => "authors",
    "translators" => "authors",
    "original_title" => "original_title",
    "original_authors" => "original_authors",
    "sources" => "sources"
  }

  # The order an exported file writes its columns in.
  @csv_headers [
    "title",
    "year",
    "countries",
    "publishers",
    "authors",
    "original_title",
    "original_authors",
    "sources"
  ]

  # The cells holding several values, and what separates them. A semicolon,
  # because a comma separates the columns and appears inside names often enough
  # that "Farrar, Straus and Giroux" has to stay one publisher.
  #
  # Sources keep the line break they are written with: a bibliographic entry
  # carries semicolons of its own, and cannot carry a line break.
  @csv_lists %{
    "sources" => {"\n", "\n"},
    "countries" => {";", "; "},
    "publishers" => {";", "; "},
    "authors" => {";", "; "},
    "original_authors" => {";", "; "}
  }

  @doc """
  Reads a CSV of publications: one row each, columns named by a header.

  The header decides which column is which, so they may be written in any order
  and a column the file does not carry reads as empty. A name the table does not
  know is ignored, which is what lets a spreadsheet keep a column of its own.
  """
  def from_csv(path) do
    try do
      publications =
        path
        |> File.stream!()
        |> CSV.decode!(headers: true)
        |> Enum.map(&rename_columns/1)
        |> Enum.map(&Util.deep_merge_maps(@empty_flat_attrs, &1))
        |> Enum.map(&parse_list_cells/1)

      {:ok, publications}
    rescue
      _ in CSV.EscapeSequenceError ->
        {:error, :invalid_escape_sequence}

      _ in CSV.StrayEscapeCharacterError ->
        {:error, :stray_escape_character}

      _ in File.Error ->
        {:error, :file_not_found}
    end
  end

  @doc """
  Writes publications as a CSV with a header, in the shape `from_csv/1` reads.
  """
  def to_csv(flat_publications) do
    flat_publications
    |> Enum.map(&Util.stringify_keys/1)
    |> Enum.map(&join_list_cells/1)
    |> Enum.map(&Map.take(&1, @csv_headers))
    |> CSV.encode(delimiter: "\n", headers: true)
    |> Enum.to_list()
  end

  # A row under the names the rest of the application uses, dropping the columns
  # the table does not know. Header names are matched trimmed and case-folded, so
  # a stray space or a capital does not lose a column.
  #
  # Values are trimmed here rather than where each is read: a title written with
  # a trailing space is the same title, and left alone it would be a record of
  # its own.
  defp rename_columns(row) do
    row
    |> Map.new(fn {column, value} -> {column_name(column), trimmed(value)} end)
    |> Map.delete(nil)
  end

  defp column_name(column) do
    Map.get(@csv_columns, column |> to_string() |> String.trim() |> String.downcase())
  end

  defp trimmed(value) when is_binary(value), do: String.trim(value)
  defp trimmed(value), do: value

  # Each multi-value cell becomes the trimmed, blank-free list the rest of the
  # application speaks in; a column the file does not carry reads as empty.
  defp parse_list_cells(row) do
    Enum.reduce(@csv_lists, row, fn {column, {separator, _}}, row ->
      Map.put(row, column, split_cell(Map.get(row, column), separator))
    end)
  end

  defp split_cell(content, separator) when is_binary(content) do
    content
    |> String.split(separator)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  defp split_cell(_absent, _separator), do: []

  # Only a cell that is there is joined: a `select`-limited export leaves some
  # columns out, and they must not reappear empty.
  defp join_list_cells(row) do
    Enum.reduce(@csv_lists, row, fn {column, {_, separator}}, row ->
      case Map.get(row, column) do
        values when is_list(values) -> Map.put(row, column, Enum.join(values, separator))
        _ -> row
      end
    end)
  end

  def from_csv!(path) do
    case from_csv(path) do
      {:ok, publications} -> publications
      {:error, error} -> throw(error)
    end
  end

  @doc ~S"""
  Nest a flat publication — a `FlatPublication` struct, a flat map, or a list of
  them — into the shape the `Publication` changeset expects: multi-value fields
  become child maps, and the `translated_book`/`original_book` fields are
  re-parented under their association.

  ## Examples

    iex> nested =
    ...>   RichardBurton.Publication.Codec.nest(%{
    ...>     "title" => "Dom Casmurro",
    ...>     "authors" => "Helen Caldwell",
    ...>     "original_title" => "Dom Casmurro",
    ...>     "original_authors" => "Machado de Assis"
    ...>   })
    iex> nested["translated_book"]["authors"]
    [%{"name" => "Helen Caldwell"}]
    iex> nested["translated_book"]["original_book"]["title"]
    "Dom Casmurro"
  """
  def nest(flat_publication = %FlatPublication{}) do
    attrs =
      flat_publication
      |> Map.from_struct()
      |> Map.delete(:__meta__)
      |> nest

    %Publication{}
    |> Publication.changeset(attrs)
    |> Ecto.Changeset.apply_changes()
  end

  def nest(flat_publication_like_map) when is_map(flat_publication_like_map) do
    flat_publication_like_map
    |> Map.new(&(&1 |> Util.stringify_keys() |> nest_entry |> rename_key))
    |> Codec.nest()
  end

  def nest(flat_publication_like_maps) when is_list(flat_publication_like_maps) do
    Enum.map(flat_publication_like_maps, &nest/1)
  end

  # The entries whose flat value is a joined string the nested shape needs as
  # child maps; everything else passes through unchanged.
  defp nest_entry({"authors", value}),
    do: {"authors", Author.nest(value)}

  defp nest_entry({"original_authors", value}),
    do: {"original_authors", Author.nest(value)}

  defp nest_entry({"countries", value}),
    do: {"countries", Country.nest(value)}

  defp nest_entry({"publishers", value}),
    do: {"publishers", Publisher.nest(value)}

  defp nest_entry({"sources", value}),
    do: {"sources", Source.nest(value)}

  defp nest_entry({key, value}),
    do: {key, value}

  @doc ~S"""
  Flatten a nested publication back to flat, string-keyed fields — the inverse of
  `nest/1`. Child lists become lists of the names or codes they hold, and the
  `translated_book` association is lifted back to top-level `authors` /
  `original_title` / `original_authors`. Accepts a `Publication` struct, a nested
  map, a list, or a `%{publication:, errors:}` pair.

  ## Examples

    iex> RichardBurton.Publication.Codec.flatten(%{
    ...>   "title" => "Dom Casmurro",
    ...>   "translated_book" => %{
    ...>     "authors" => [%{"name" => "Helen Caldwell"}],
    ...>     "original_book" => %{
    ...>       "title" => "Dom Casmurro",
    ...>       "authors" => [%{"name" => "Machado de Assis"}]
    ...>     }
    ...>   }
    ...> })
    %{"authors" => ["Helen Caldwell"], "original_authors" => ["Machado de Assis"], "original_title" => "Dom Casmurro", "title" => "Dom Casmurro"}
  """
  def flatten(publication = %Publication{}) do
    attrs =
      publication
      |> map_from_struct
      |> Map.delete(:__meta__)
      |> flatten

    %FlatPublication{}
    |> FlatPublication.changeset(attrs)
    |> Ecto.Changeset.put_change(:id, publication.id)
    |> Ecto.Changeset.apply_changes()
  end

  def flatten(%{publication: publication, errors: errors})
      when is_nil(errors) or is_atom(errors) do
    %{"publication" => flatten(publication), "errors" => errors}
  end

  def flatten(%{publication: publication, errors: errors}) do
    %{"publication" => flatten(publication), "errors" => flatten(errors)}
  end

  def flatten(publication_like_maps) when is_list(publication_like_maps) do
    Enum.map(publication_like_maps, &flatten/1)
  end

  def flatten(publication_like_map) when is_map(publication_like_map) do
    publication_like_map |> Codec.flatten() |> Map.new(&(&1 |> rename_key |> flatten_entry))
  end

  # The reverse: child structs rendered back as the joined strings the flat shape
  # carries.
  defp flatten_entry({"authors", value}), do: {"authors", Author.flatten(value)}
  defp flatten_entry({"original_authors", value}), do: {"original_authors", Author.flatten(value)}
  defp flatten_entry({"countries", value}), do: {"countries", Country.flatten(value)}
  defp flatten_entry({"publishers", value}), do: {"publishers", Publisher.flatten(value)}
  defp flatten_entry({"sources", value}), do: {"sources", Source.flatten(value)}
  defp flatten_entry({key, value}), do: {key, value}

  # Translates between the flat names a client uses and the nested paths the
  # schema stores them under. The two directions are separate clauses on the same
  # function, so each name is written once per direction.
  defp rename_key({"translated_book_authors", v}), do: {"authors", v}
  defp rename_key({"translated_book_original_book_title", v}), do: {"original_title", v}
  defp rename_key({"translated_book_original_book_authors", v}), do: {"original_authors", v}

  defp rename_key({"authors", v}), do: {"translated_book_authors", v}
  defp rename_key({"original_title", v}), do: {"translated_book_original_book_title", v}
  defp rename_key({"original_authors", v}), do: {"translated_book_original_book_authors", v}

  defp rename_key({key, value}), do: {key, value}

  # A struct as a plain map, recursively, so a loaded record can be compared and
  # encoded without its Ecto metadata.
  defp map_from_struct(struct) when is_struct(struct) do
    struct
    |> Map.from_struct()
    |> Map.new(fn {key, value} -> {key, map_from_struct(value)} end)
  end

  defp map_from_struct(value), do: value
end
