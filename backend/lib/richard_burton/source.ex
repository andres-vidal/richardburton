defmodule RichardBurton.Source do
  @moduledoc """
  A source of a publication: a free-text entry that records where the
  publication's data was collected, so a reader can check it. A publication's
  sources are ordered by `position`, belong to it alone and are deleted with
  it, and they change with the publication's own update.

  A source has a text in each of two languages, Portuguese in `content_pt` and
  English in `content_en`. Either may be missing, but not both. Neither text
  is the original: the two hold the same entry in two languages.

  Terms used here:

    * **text** — the content of a source in one language, a string that is
      not blank. A blank string is no text.
    * **flat source** — a source as the flat shape of a publication holds
      it: `%{"pt" => text, "en" => text}`, with nil for a language the source
      has no text in. `flat/1` builds one.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias RichardBurton.Source

  @readable_attributes [:content_pt, :content_en, :position]

  @derive {Jason.Encoder, only: @readable_attributes}
  schema "publication_sources" do
    field(:content_pt, :string)
    field(:content_en, :string)
    field(:position, :integer)

    belongs_to(:publication, RichardBurton.Publication)

    timestamps()
  end

  @doc """
  Casts a source's `content_pt`, `content_en` and `position`, and adds a
  `:content_pt` error with the code `:required` when the source has text in
  neither language.
  """
  def changeset(source, attrs \\ %{}) do
    source
    |> cast(attrs, [:content_pt, :content_en, :position])
    |> validate_has_text()
  end

  # Adds the error `changeset/2` describes when neither text is cast.
  defp validate_has_text(changeset) do
    if get_field(changeset, :content_pt) || get_field(changeset, :content_en),
      do: changeset,
      else: add_error(changeset, :content_pt, "can't be blank", validation: :required)
  end

  @doc ~S"""
  Returns `source` as a flat source. A string is a source with that text in
  Portuguese and no English text. A map may have atom or string keys, and a
  blank or missing text becomes nil. Any other value is returned as it is.

  ## Examples

    iex> RichardBurton.Source.flat("Caldwell, Helen. Introduction, 1953.")
    %{"pt" => "Caldwell, Helen. Introduction, 1953.", "en" => nil}

    iex> RichardBurton.Source.flat(%{pt: " ", en: "Preface"})
    %{"pt" => nil, "en" => "Preface"}
  """
  def flat(text) when is_binary(text), do: %{"pt" => text(text), "en" => nil}

  def flat(source = %{}) do
    %{
      "pt" => source |> Map.get("pt", Map.get(source, :pt)) |> text(),
      "en" => source |> Map.get("en", Map.get(source, :en)) |> text()
    }
  end

  def flat(other), do: other

  # Returns a string that is not blank, and nil for a blank string or for nil.
  defp text(value) when is_binary(value), do: if(String.trim(value) == "", do: nil, else: value)
  defp text(value), do: value

  @doc """
  Returns whether `value` is a flat source with text in at least one language,
  and whose texts are strings or nil.
  """
  def flat?(%{"pt" => pt, "en" => en}) do
    (is_binary(pt) or is_nil(pt)) and (is_binary(en) or is_nil(en)) and not blank?(pt, en)
  end

  def flat?(_value), do: false

  # Returns whether a source has text in neither language.
  defp blank?(pt, en), do: is_nil(pt) and is_nil(en)

  @doc ~S"""
  Nests a flat publication's ordered list of sources into the maps
  `cast_assoc(:sources)` casts, with each `position` taken from the order.
  Each source is read with `flat/1`, so a string is a Portuguese text. A source
  with text in neither language is dropped instead of failing validation, and
  any value that is not a list gives no sources.

  ## Examples

    iex> RichardBurton.Source.nest([%{"pt" => "Primeira fonte", "en" => "First source"}, "Segunda fonte"])
    [
      %{"content_pt" => "Primeira fonte", "content_en" => "First source", "position" => 0},
      %{"content_pt" => "Segunda fonte", "content_en" => nil, "position" => 1}
    ]

    A source blank in both languages is dropped, and the positions stay
    contiguous. The entry after it is `1`, not `2`:

    iex> RichardBurton.Source.nest([%{"en" => "First"}, %{"pt" => " ", "en" => ""}, "Second"])
    [
      %{"content_pt" => nil, "content_en" => "First", "position" => 0},
      %{"content_pt" => "Second", "content_en" => nil, "position" => 1}
    ]

    iex> RichardBurton.Source.nest(nil)
    []
  """
  def nest(sources) when is_list(sources) do
    sources
    |> Enum.map(&flat/1)
    |> Enum.reject(&match?(%{"pt" => nil, "en" => nil}, &1))
    |> Enum.with_index()
    |> Enum.map(fn {source, position} ->
      %{"content_pt" => source["pt"], "content_en" => source["en"], "position" => position}
    end)
  end

  def nest(_), do: []

  @doc ~S"""
  Flattens sources to flat sources, the reverse of `nest/1`. Takes loaded
  `Source` structs, which it orders by `position`, or a list that is already
  flat, whose entries it reads with `flat/1`. Any other value, such as nil or
  an association that is not loaded, gives an empty list.

  ## Examples

    iex> RichardBurton.Source.flatten([
    ...>   %RichardBurton.Source{content_pt: "Segunda", content_en: "Second", position: 1},
    ...>   %RichardBurton.Source{content_pt: "Primeira", position: 0}
    ...> ])
    [%{"pt" => "Primeira", "en" => nil}, %{"pt" => "Segunda", "en" => "Second"}]

    iex> RichardBurton.Source.flatten(["A source"])
    [%{"pt" => "A source", "en" => nil}]

    iex> RichardBurton.Source.flatten(nil)
    []
  """
  def flatten(sources = [%Source{} | _]) do
    sources
    |> Enum.sort_by(& &1.position)
    |> Enum.map(&%{"pt" => &1.content_pt, "en" => &1.content_en})
  end

  def flatten(sources) when is_list(sources), do: Enum.map(sources, &flat/1)
  def flatten(_), do: []

  defmodule Flat do
    @moduledoc """
    An Ecto type for a publication's sources in their flat shape: a list of
    flat sources, as `RichardBurton.Source` defines them, in order.

    Casting reads each entry with `RichardBurton.Source.flat/1`, so a string
    is a Portuguese text, and drops an entry with text in neither language.
    It fails with the validation `:malformed` when the value is not a list,
    or when an entry is neither a string nor a map, or holds a text that is
    not a string. Loading reads each entry the same way, from the JSON array a
    `jsonb` column holds.
    """
    use Ecto.Type

    alias RichardBurton.Source

    @impl true
    def type, do: :map

    @impl true
    def cast(sources) when is_list(sources) do
      flat =
        sources
        |> Enum.map(&Source.flat/1)
        |> Enum.reject(&match?(%{"pt" => nil, "en" => nil}, &1))

      if Enum.all?(flat, &Source.flat?/1),
        do: {:ok, flat},
        else: {:error, validation: :malformed}
    end

    def cast(_sources), do: {:error, validation: :malformed}

    @impl true
    def load(sources) when is_list(sources), do: {:ok, Enum.map(sources, &Source.flat/1)}
    def load(_sources), do: :error

    @impl true
    def dump(sources) when is_list(sources), do: {:ok, sources}
    def dump(_sources), do: :error
  end
end
