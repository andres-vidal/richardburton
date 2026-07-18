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
    "publishers"
  ]

  # Export includes provenance; import does not (that is roadmap 16). Kept as a
  # separate list so `from_csv` never expects a references column. The list is
  # flattened into one cell with `@references_csv_separator` — lossy for content
  # that contains the separator, which 16 addresses with escaping.
  @csv_export_headers @csv_headers ++ ["references"]
  @references_csv_separator " | "

  def from_csv(path) do
    try do
      publications =
        path
        |> File.stream!()
        |> CSV.decode!(separator: ?;, headers: @csv_headers)
        |> Enum.map(&Util.deep_merge_maps(@empty_flat_attrs, &1))

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
    |> Enum.map(&flatten_references_cell/1)
    |> Enum.map(&Map.take(&1, @csv_export_headers))
    |> CSV.encode(separator: ?;, delimiter: "\n", headers: true)
    |> Enum.to_list()
  end

  # Only touch the cell when it's present (a full export) — a `select`-limited
  # export omits references entirely, and must not gain the column.
  defp flatten_references_cell(%{"references" => refs} = row) when is_list(refs) do
    %{row | "references" => Enum.join(refs, @references_csv_separator)}
  end

  defp flatten_references_cell(row), do: row

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
  Nest a comma-separated authors string into author maps — used when building a
  translated book's author associations.

  ## Examples

    iex> RichardBurton.Publication.Codec.nest_authors("Helen Caldwell, Gregory Rabassa")
    [%{"name" => "Helen Caldwell"}, %{"name" => "Gregory Rabassa"}]
  """
  def nest_authors(authors) when is_binary(authors) do
    Enum.map(String.split(authors, ","), &%{"name" => String.trim(&1)})
  end

  @doc ~S"""
  Flatten a nested publication back to flat, string-keyed fields — the inverse of
  `nest/1`. Child lists are joined and the `translated_book` association is lifted
  back to top-level `authors` / `original_title` / `original_authors`. Accepts a
  `Publication` struct, a nested map, a list, or a `%{publication:, errors:}` pair.

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
    %{"authors" => "Helen Caldwell", "original_authors" => "Machado de Assis", "original_title" => "Dom Casmurro", "title" => "Dom Casmurro"}
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
