defmodule RichardBurton.Publication.Codec do
  @moduledoc """
  Converts publications between their flat and nested shapes, and reads and
  writes them as CSV.

  The **flat** shape is the one `RichardBurton.FlatPublication` has: `title`,
  `year`, `countries`, `publishers`, `authors`, `original_title`,
  `original_authors`, `sources`, `notes_pt` and `notes_en`, side by side. Each
  list of countries, publishers or authors holds names or codes, the sources
  are flat sources (see `RichardBurton.Source`), and the notes in each
  language are rich text (see `RichardBurton.RichText`).

  The **nested** shape is the one `RichardBurton.Publication.changeset/2`
  casts. Its list fields hold child maps, such as `%{"name" => name}`, and the
  translators, the original title and the original authors are inside the
  translated book:

      %{
        "title" => title,
        "year" => year,
        "notes_pt" => blocks,
        "notes_en" => blocks,
        "countries" => [%{"code" => code}],
        "publishers" => [%{"name" => name}],
        "sources" => [%{"content_pt" => text, "content_en" => text, "position" => 0}],
        "translated_book" => %{
          "authors" => [%{"name" => name}],
          "original_book" => %{"title" => title, "authors" => [%{"name" => name}]}
        }
      }

  A CSV file holds the sources in two cells, `sources_pt` and `sources_en`,
  one source per line. Line N of each cell is the same source, and an empty
  line is a source with no text in that language. A row is **misaligned**
  when both cells hold a text and one of them holds a text on a line the other
  does not have, so the file does not say which source that text belongs
  with. A cell ending in empty lines has those lines, so it can say that the
  last sources have no text in its language.
  """

  alias RichardBurton.Author
  alias RichardBurton.Country
  alias RichardBurton.Util
  alias RichardBurton.Publication
  alias RichardBurton.Publisher
  alias RichardBurton.RichText
  alias RichardBurton.Source
  alias RichardBurton.FlatPublication

  # The values a row read from a file holds for the fields its file has no
  # column for.
  @empty_flat_attrs %{
    "title" => "",
    "year" => "",
    "countries" => "",
    "publishers" => "",
    "authors" => "",
    "original_title" => "",
    "original_authors" => "",
    "notes_pt" => nil,
    "notes_en" => nil
  }

  # The columns a file may carry, by the name its header gives them. Singular
  # names are accepted because a spreadsheet writes what a person would. A
  # `sources` or `notes` column, which names no language, reads as the
  # Portuguese one.
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
    "sources" => "sources_pt",
    "sources_pt" => "sources_pt",
    "sources_en" => "sources_en",
    "note" => "notes_pt",
    "notes" => "notes_pt",
    "notes_pt" => "notes_pt",
    "notes_en" => "notes_en"
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
    "sources_pt",
    "sources_en",
    "notes_pt",
    "notes_en"
  ]

  # The cells holding several values, and what separates them. A semicolon,
  # because a comma separates the columns and appears inside names often enough
  # that "Farrar, Straus and Giroux" has to stay one publisher. The sources
  # cells are read apart, by `parse_sources/1`.
  @csv_lists %{
    "countries" => {";", "; "},
    "publishers" => {";", "; "},
    "authors" => {";", "; "},
    "original_authors" => {";", "; "}
  }

  # The cells holding the sources in each language.
  @source_cells ["sources_pt", "sources_en"]

  # What separates the sources in a cell. A source keeps the line break it is
  # written with: a bibliographic entry carries semicolons of its own, and
  # cannot carry a line break.
  @source_separator "\n"

  # The key of the attrs that marks a row's sources as misaligned.
  @misaligned_sources "sources_misaligned"

  # The notes in each language.
  @notes ["notes_pt", "notes_en"]

  @doc """
  Reads a CSV of publications: one row each, columns named by a header.

  The header decides which column is which, so they may be written in any order
  and a column the file does not carry reads as empty. A name the table does not
  know is ignored, which is what lets a spreadsheet keep a column of its own.

  The `sources_pt` and `sources_en` cells read as one list of flat sources, as
  the module doc describes them. A line with no text in either cell is
  dropped. A misaligned row reads with the sources its lines pair up to, an
  empty line taking the place of each missing one, and with the key
  `misaligned_sources/0` names set to true, which
  `RichardBurton.FlatPublication` reports as the error `:misaligned` on the
  sources.

  A `notes_pt` or `notes_en` cell holds plain text, which may run over several
  lines inside quotes, and reads as the rich text
  `RichardBurton.RichText.from_plain_text/1` returns for it: a paragraph for
  each part of the text between blank lines, with a link for each web address
  or email address in it. A blank or missing notes cell reads as nil.
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
        |> Enum.map(&parse_sources/1)
        |> Enum.map(&parse_notes/1)

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
  Returns the key of the attrs that marks a row's sources as misaligned. See
  `from_csv/1`.
  """
  def misaligned_sources, do: @misaligned_sources

  @doc """
  Writes publications as a CSV with a header, in the shape `from_csv/1` reads.

  The columns come in this order: `title`, `year`, `countries`, `publishers`,
  `authors`, `original_title`, `original_authors`, `sources_pt`,
  `sources_en`, `notes_pt` and `notes_en`. The file has a column for each of
  them that the first publication holds, and both sources columns when it
  holds `sources`, so every publication must hold the same fields. The notes
  are written as the plain text `RichardBurton.RichText.to_plain_text/1`
  returns for them.
  """
  def to_csv(flat_publications) do
    rows =
      flat_publications
      |> Enum.map(&Util.stringify_keys/1)
      |> Enum.map(&join_list_cells/1)
      |> Enum.map(&write_sources/1)
      |> Enum.map(&write_notes/1)

    rows
    |> CSV.encode(delimiter: "\n", headers: columns(rows))
    |> Enum.to_list()
  end

  # Returns the fields of `@csv_headers` that the first of `rows` holds, in
  # the order `@csv_headers` lists them.
  defp columns([]), do: []
  defp columns([row | _]), do: Enum.filter(@csv_headers, &Map.has_key?(row, &1))

  # Returns a row with its columns renamed to the flat fields `@csv_columns`
  # maps them to, and its values trimmed, leaving out the columns it does not
  # know. A title written with a trailing space is the same title, so the
  # values are trimmed here, before anything compares them. The sources cells
  # keep their empty lines, which say where each source is, and
  # `parse_sources/1` trims each line instead.
  defp rename_columns(row) do
    row
    |> Map.new(fn {column, value} ->
      field = column_name(column)
      {field, if(field in @source_cells, do: value, else: trimmed(value))}
    end)
    |> Map.delete(nil)
  end

  # Returns the flat field a header names, matched trimmed and lowercased, or
  # nil when it names none.
  defp column_name(column) do
    Map.get(@csv_columns, column |> to_string() |> String.trim() |> String.downcase())
  end

  # Returns a string trimmed, and any other value as it is.
  defp trimmed(value) when is_binary(value), do: String.trim(value)
  defp trimmed(value), do: value

  # Splits each cell of the fields in `@csv_lists` into a list of trimmed
  # values, leaving out the blank ones. A field the row does not hold becomes
  # an empty list.
  defp parse_list_cells(row) do
    Enum.reduce(@csv_lists, row, fn {column, {separator, _}}, row ->
      Map.put(row, column, split_cell(Map.get(row, column), separator))
    end)
  end

  # Returns the values of a cell, or an empty list for a missing cell.
  defp split_cell(content, separator) when is_binary(content) do
    content
    |> String.split(separator)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  defp split_cell(_absent, _separator), do: []

  # Returns a row with its `sources_pt` and `sources_en` cells replaced by
  # `sources`, the flat sources their lines pair up to, as `from_csv/1`
  # describes, and with the misaligned mark when the cells are misaligned.
  defp parse_sources(row) do
    {pt, row} = Map.pop(row, "sources_pt")
    {en, row} = Map.pop(row, "sources_en")
    pt = source_lines(pt)
    en = source_lines(en)

    sources =
      Enum.map(0..(max(reach(pt), reach(en)) - 1)//1, fn line ->
        Source.flat(%{"pt" => Enum.at(pt, line), "en" => Enum.at(en, line)})
      end)
      |> Enum.reject(&match?(%{"pt" => nil, "en" => nil}, &1))

    row = Map.put(row, "sources", sources)

    if misaligned?(pt, en),
      do: Map.put(row, @misaligned_sources, true),
      else: row
  end

  # Returns the trimmed lines of a sources cell, or an empty list for a missing
  # cell.
  defp source_lines(cell) when is_binary(cell),
    do: cell |> String.split(@source_separator) |> Enum.map(&String.trim/1)

  defp source_lines(_absent), do: []

  # Returns how many lines of a sources cell reach its last text: its number of
  # lines without the empty lines at its end.
  defp reach(lines), do: lines |> Enum.reverse() |> Enum.drop_while(&(&1 == "")) |> length()

  # Returns whether the lines of two sources cells are misaligned: both cells
  # hold a text, and one of them holds a text on a line the other cell does
  # not have. An empty line the other cell writes counts as one of its lines,
  # so a cell can show that the last sources have no text in its language by
  # ending in empty lines.
  defp misaligned?(pt, en) do
    reach(pt) > 0 and reach(en) > 0 and (reach(pt) > length(en) or reach(en) > length(pt))
  end

  # Returns a row with each notes cell read as rich text, which is nil for a
  # blank or missing cell.
  defp parse_notes(row) do
    Enum.reduce(
      @notes,
      row,
      &Map.update!(&2, &1, fn notes -> RichText.from_plain_text(notes) end)
    )
  end

  # Joins each list of the fields in `@csv_lists` into one cell. A field the
  # row does not hold is left out rather than written empty, because an
  # export of some columns leaves the others out.
  defp join_list_cells(row) do
    Enum.reduce(@csv_lists, row, fn {column, {_, separator}}, row ->
      case Map.get(row, column) do
        values when is_list(values) -> Map.put(row, column, Enum.join(values, separator))
        _ -> row
      end
    end)
  end

  # Returns a row with its `sources` written as the two cells `sources_pt` and
  # `sources_en`, one line per source, as the module doc describes. A row
  # without a `sources` field is returned unchanged.
  defp write_sources(row = %{"sources" => sources}) when is_list(sources) do
    sources = Source.flatten(sources)

    row
    |> Map.delete("sources")
    |> Map.put("sources_pt", Enum.map_join(sources, @source_separator, &(&1["pt"] || "")))
    |> Map.put("sources_en", Enum.map_join(sources, @source_separator, &(&1["en"] || "")))
  end

  defp write_sources(row), do: row

  # Returns a row with its notes in each language written as plain text. A
  # notes field the row does not hold is left out.
  defp write_notes(row) do
    Enum.reduce(@notes, row, fn field, row ->
      case Map.fetch(row, field) do
        {:ok, notes} -> Map.put(row, field, RichText.to_plain_text(notes))
        :error -> row
      end
    end)
  end

  @doc ~S"""
  Nests a flat publication into the nested shape. Takes a `FlatPublication`
  struct, a flat map with atom or string keys, or a list of either.

  A map comes back with string keys. Its list fields hold child maps, and its
  `authors`, `original_title` and `original_authors` are under
  `translated_book`. Only the fields the map holds are written: a map without
  `authors` gets a translated book without `"authors"`, and a map without any
  of the three gets no translated book. Every other entry keeps its key and
  value.

  A `FlatPublication` comes back as the `Publication` struct the nested shape
  casts to.

  ## Examples

    iex> nested =
    ...>   RichardBurton.Publication.Codec.nest(%{
    ...>     "title" => "Dom Casmurro",
    ...>     "authors" => ["Helen Caldwell"],
    ...>     "original_title" => "Dom Casmurro",
    ...>     "original_authors" => ["Machado de Assis"]
    ...>   })
    iex> nested["translated_book"]["authors"]
    [%{"name" => "Helen Caldwell"}]
    iex> nested["translated_book"]["original_book"]["title"]
    "Dom Casmurro"

    iex> RichardBurton.Publication.Codec.nest(%{original_title: "Iracema"})
    %{"translated_book" => %{"original_book" => %{"title" => "Iracema"}}}
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
    |> Util.stringify_keys()
    |> Enum.reduce(%{}, fn entry, nested ->
      {key, value} = nest_entry(entry)
      put_in(nested, path_to(key), value)
    end)
  end

  def nest(flat_publication_like_maps) when is_list(flat_publication_like_maps) do
    Enum.map(flat_publication_like_maps, &nest/1)
  end

  # The flat fields that belong to the translated book, and the path of keys to
  # each in the nested shape. Every other field is at the top of both shapes.
  @book_paths %{
    "authors" => ["translated_book", "authors"],
    "original_title" => ["translated_book", "original_book", "title"],
    "original_authors" => ["translated_book", "original_book", "authors"]
  }

  # The path of `Access` keys where `nest/1` writes the flat field `key`. Each
  # key creates the map it reads from when that map is missing.
  defp path_to(key), do: @book_paths |> Map.get(key, [key]) |> Enum.map(&Access.key(&1, %{}))

  # The entries whose flat value is a list of names or codes that the nested
  # shape holds as child maps. Every other entry is returned unchanged.
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
  Flattens a nested publication into the flat shape, the inverse of `nest/1`.
  Takes a `Publication` struct, a nested map with atom or string keys, a list,
  or a `%{publication:, errors:}` pair.

  A map comes back with string keys. Its list fields hold the names or codes of
  their child maps. The translated book's `authors`, and its original book's
  `title` and `authors`, come back as `authors`, `original_title` and
  `original_authors`. Any other field of the translated book or the original
  book is left out. When `translated_book` is not a map, such as the error
  `:required`, it is kept under its own key. Every other entry keeps its key and
  value, nested maps included.

  A `Publication` struct comes back as a `FlatPublication` struct with the same
  id. A pair comes back with its publication flattened, and with its errors
  as `flatten_errors/1` returns them.

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

    iex> RichardBurton.Publication.Codec.flatten(%{
    ...>   translated_book: %{id: 7, original_book: %{title: "Iracema"}}
    ...> })
    %{"original_title" => "Iracema"}
  """
  def flatten(publication = %Publication{}) do
    attrs = publication |> Map.from_struct() |> flatten()

    %FlatPublication{}
    |> FlatPublication.changeset(attrs)
    |> Ecto.Changeset.put_change(:id, publication.id)
    |> Ecto.Changeset.apply_changes()
  end

  def flatten(%{publication: publication, errors: errors}) do
    %{"publication" => flatten(publication), "errors" => flatten_errors(errors)}
  end

  def flatten(publication_like_maps) when is_list(publication_like_maps) do
    Enum.map(publication_like_maps, &flatten/1)
  end

  def flatten(publication_like_map) when is_map(publication_like_map) do
    publication_like_map
    |> Util.stringify_keys()
    |> lift_book()
    |> Map.new(&flatten_entry/1)
  end

  @doc """
  Flattens the errors of a nested publication, as
  `RichardBurton.Validation.get_errors/1` returns them, into errors by flat
  field, the shape `RichardBurton.FlatPublication.validate/2` reports. Nil and
  an atom, such as `:conflict`, are returned as they are.

  A map comes back with string keys, and with the errors of the translated
  book's fields under the flat names `flatten/1` gives them. The errors of a
  list of child maps, such as the countries, become one code: the code of the
  first child that has an error.

  ## Examples

      iex> RichardBurton.Publication.Codec.flatten_errors(%{
      ...>   countries: [%{}, %{code: :alpha2}],
      ...>   translated_book: %{original_book: %{title: :required}}
      ...> })
      %{"countries" => :alpha2, "original_title" => :required}
  """
  def flatten_errors(errors) when is_map(errors) do
    errors
    |> Util.stringify_keys()
    |> lift_book()
    |> Map.new(fn {field, error} -> {field, error_code(error)} end)
  end

  def flatten_errors(errors), do: errors

  # Returns the code of a field's errors. A list holds the errors of the field's
  # children, one map each, and an empty map for a child without errors.
  defp error_code(children) when is_list(children) do
    Enum.find_value(children, fn child -> child |> Map.values() |> List.first() end)
  end

  defp error_code(code), do: code

  # Replaces a `translated_book` map with the flat fields `nest/1` puts inside
  # it, as `@book_paths` lists them. A field the book does not hold is left out.
  # A map without a `translated_book` map is returned unchanged.
  defp lift_book(nested = %{"translated_book" => book}) when is_map(book) do
    lifted =
      for {key, path} <- @book_paths, {:ok, value} <- [fetch_in(nested, path)], into: %{} do
        {key, value}
      end

    nested |> Map.delete("translated_book") |> Map.merge(lifted)
  end

  defp lift_book(nested), do: nested

  # Returns `{:ok, value}` for the value at `path` in a nested map, or `:error`
  # when the path does not reach one. Each map along the path may have atom or
  # string keys, and may be a struct.
  defp fetch_in(value, []), do: {:ok, value}

  defp fetch_in(map, [key | path]) when is_map(map) do
    case map |> Util.stringify_keys() |> Map.fetch(key) do
      {:ok, value} -> fetch_in(value, path)
      :error -> :error
    end
  end

  defp fetch_in(_value, _path), do: :error

  # The reverse of `nest_entry/1`: child maps or structs as the names or codes
  # they hold.
  defp flatten_entry({"authors", value}), do: {"authors", Author.flatten(value)}
  defp flatten_entry({"original_authors", value}), do: {"original_authors", Author.flatten(value)}
  defp flatten_entry({"countries", value}), do: {"countries", Country.flatten(value)}
  defp flatten_entry({"publishers", value}), do: {"publishers", Publisher.flatten(value)}
  defp flatten_entry({"sources", value}), do: {"sources", Source.flatten(value)}
  defp flatten_entry({key, value}), do: {key, value}
end
