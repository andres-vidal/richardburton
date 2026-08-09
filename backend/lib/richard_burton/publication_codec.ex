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
  alias RichardBurton.Reference
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

  @csv_headers [
    "original_authors",
    "year",
    "countries",
    "original_title",
    "title",
    "authors",
    "publishers",
    "references"
  ]

  # The cells that hold several values: what separates them on the way in, and
  # what joins them on the way out. A publication's countries, publishers and
  # names are lists everywhere else — one cell per list is CSV's own convention,
  # and this is the only place that knows it.
  @csv_lists %{
    "references" => {"\n", "\n"},
    "countries" => {",", ", "},
    "publishers" => {",", ", "},
    "authors" => {",", ", "},
    "original_authors" => {",", ", "}
  }

  def from_csv(path) do
    try do
      publications =
        path
        |> File.stream!()
        |> CSV.decode!(separator: ?;, headers: @csv_headers)
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

  def to_csv(flat_publications) do
    flat_publications
    |> Enum.map(&Util.stringify_keys/1)
    |> Enum.map(&join_list_cells/1)
    |> Enum.map(&Map.take(&1, @csv_headers))
    |> CSV.encode(separator: ?;, delimiter: "\n", headers: true)
    |> Enum.to_list()
  end

  # Each multi-value cell becomes the trimmed, blank-free list the rest of the
  # application speaks in; a column the file does not carry reads as empty.
  defp parse_list_cells(row) do
    Enum.reduce(@csv_lists, row, fn {column, {separator, _}}, row ->
      Map.put(row, column, split_cell(Map.get(row, column), separator))
    end)
  end

  # A comma can be part of a name rather than a break between two — a publisher
  # called "Cassel, McBride & Co." is one value. Quoting it says so, and is the
  # only way the file can: the column separator is a semicolon, so a comma has
  # no other reading available to it.
  defp split_cell(content, ",") when is_binary(content) do
    content |> outside_quotes() |> Enum.map(&unwrap/1) |> Enum.reject(&(&1 == ""))
  end

  # A line break cannot occur inside a source, so references need no such escape.
  defp split_cell(content, separator) when is_binary(content) do
    content
    |> String.split(separator)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  defp split_cell(_absent, _separator), do: []

  defp outside_quotes(content) do
    {values, last, _} =
      content
      |> String.graphemes()
      |> Enum.reduce({[], "", false}, fn
        "\"", {values, current, quoted?} -> {values, current <> "\"", not quoted?}
        ",", {values, current, false} -> {[current | values], "", false}
        char, {values, current, quoted?} -> {values, current <> char, quoted?}
      end)

    Enum.reverse([last | values])
  end

  defp unwrap(value) do
    trimmed = String.trim(value)

    if String.length(trimmed) > 1 and String.starts_with?(trimmed, "\"") and
         String.ends_with?(trimmed, "\"") do
      trimmed |> String.slice(1..-2//1) |> String.trim()
    else
      trimmed
    end
  end

  # Only a cell that is there is joined: a `select`-limited export leaves some
  # columns out, and they must not reappear empty.
  defp join_list_cells(row) do
    Enum.reduce(@csv_lists, row, fn {column, {split, separator}}, row ->
      case Map.get(row, column) do
        values when is_list(values) ->
          Map.put(row, column, Enum.map_join(values, separator, &quoted_if_split(&1, split)))

        _ ->
          row
      end
    end)
  end

  # A value holding the separator goes out quoted, so reading the file back
  # gives one value again rather than the two it would otherwise look like.
  defp quoted_if_split(value, separator) do
    if String.contains?(value, separator), do: ~s("#{value}"), else: value
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

  defp nest_entry({"authors", value}),
    do: {"authors", Author.nest(value)}

  defp nest_entry({"original_authors", value}),
    do: {"original_authors", Author.nest(value)}

  defp nest_entry({"countries", value}),
    do: {"countries", Country.nest(value)}

  defp nest_entry({"publishers", value}),
    do: {"publishers", Publisher.nest(value)}

  defp nest_entry({"references", value}),
    do: {"references", Reference.nest(value)}

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

  defp flatten_entry({"authors", value}), do: {"authors", Author.flatten(value)}
  defp flatten_entry({"original_authors", value}), do: {"original_authors", Author.flatten(value)}
  defp flatten_entry({"countries", value}), do: {"countries", Country.flatten(value)}
  defp flatten_entry({"publishers", value}), do: {"publishers", Publisher.flatten(value)}
  defp flatten_entry({"references", value}), do: {"references", Reference.flatten(value)}
  defp flatten_entry({key, value}), do: {key, value}

  defp rename_key({"translated_book_authors", v}), do: {"authors", v}
  defp rename_key({"translated_book_original_book_title", v}), do: {"original_title", v}
  defp rename_key({"translated_book_original_book_authors", v}), do: {"original_authors", v}

  defp rename_key({"authors", v}), do: {"translated_book_authors", v}
  defp rename_key({"original_title", v}), do: {"translated_book_original_book_title", v}
  defp rename_key({"original_authors", v}), do: {"translated_book_original_book_authors", v}

  defp rename_key({key, value}), do: {key, value}

  defp map_from_struct(struct) when is_struct(struct) do
    struct
    |> Map.from_struct()
    |> Map.new(fn {key, value} -> {key, map_from_struct(value)} end)
  end

  defp map_from_struct(value), do: value
end
