defmodule RichardBurton.Source do
  @moduledoc """
  A source of a publication: a free-text entry that records where the
  publication's data was collected, so a reader can check it.

  A source is written in one language, Portuguese (`"pt"`) or English
  (`"en"`), which `language` holds (see `RichardBurton.Language`). A
  publication has a list of sources in each language, `sources_pt` and
  `sources_en`. The two lists are independent: a source in one does not stand
  for any source in the other.

  A publication's sources in one language are ordered by `position`, which
  counts from 0 in each language. They belong to the publication alone, are
  deleted with it, and change with the publication's own update.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias RichardBurton.Language
  alias RichardBurton.Source

  @readable_attributes [:content, :language, :position]

  @derive {Jason.Encoder, only: @readable_attributes}
  schema "publication_sources" do
    field(:content, :string)
    field(:language, :string)
    field(:position, :integer)

    belongs_to(:publication, RichardBurton.Publication)

    timestamps()
  end

  @doc """
  Casts a source's `content`, which is required, and its `position`, and sets
  its `language` to `language`, which must be one of `Language.codes/0`.
  """
  def changeset(source, attrs, language) do
    source
    |> cast(attrs, [:content, :position])
    |> put_change(:language, language)
    |> validate_required([:content])
    |> validate_inclusion(:language, Language.codes())
  end

  @doc ~S"""
  Nests a flat publication's ordered list of sources in one language into the
  maps `cast_assoc/3` casts, with each `position` taken from the order. Blank
  entries are dropped instead of failing validation, and any value that is not
  a list gives no sources.

  ## Examples

    iex> RichardBurton.Source.nest(["First source", "Second source"])
    [%{"content" => "First source", "position" => 0}, %{"content" => "Second source", "position" => 1}]

    iex> RichardBurton.Source.nest(["A source", "  "])
    [%{"content" => "A source", "position" => 0}]

    A blank in the middle is dropped, and the positions stay contiguous. The
    entry after it is `1`, not `2`:

    iex> RichardBurton.Source.nest(["First", "", "Second"])
    [%{"content" => "First", "position" => 0}, %{"content" => "Second", "position" => 1}]

    iex> RichardBurton.Source.nest(nil)
    []
  """
  def nest(sources) when is_list(sources) do
    sources
    |> Enum.reject(&blank?/1)
    |> Enum.with_index()
    |> Enum.map(fn {content, position} ->
      %{"content" => content, "position" => position}
    end)
  end

  def nest(_), do: []

  @doc ~S"""
  Flattens sources in one language to their contents, the reverse of
  `nest/1`. Takes loaded `Source` structs, which it orders by `position`, or a
  list that is already flat. Any other value, such as nil or an association
  that is not loaded, gives an empty list.

  ## Examples

    iex> RichardBurton.Source.flatten([
    ...>   %RichardBurton.Source{content: "Second", position: 1},
    ...>   %RichardBurton.Source{content: "First", position: 0}
    ...> ])
    ["First", "Second"]

    iex> RichardBurton.Source.flatten(nil)
    []
  """
  def flatten(sources = [%Source{} | _]) do
    sources |> Enum.sort_by(& &1.position) |> Enum.map(& &1.content)
  end

  def flatten(sources) when is_list(sources), do: sources
  def flatten(_), do: []

  # Whether a source is nil or only whitespace.
  defp blank?(value) do
    is_nil(value) or (is_binary(value) and String.trim(value) == "")
  end
end
