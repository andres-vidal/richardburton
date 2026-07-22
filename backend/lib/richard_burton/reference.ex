defmodule RichardBurton.Reference do
  @moduledoc """
  Schema for publication references: free-text provenance entries that record how
  a publication's data was collected, so a reader can verify the claim. Owned by a
  single publication (deleted with it), ordered, and edited inline via the
  publication update path — never shared or deduplicated across publications.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias RichardBurton.Reference

  @readable_attributes [:content, :position]

  @derive {Jason.Encoder, only: @readable_attributes}
  schema "publication_references" do
    field(:content, :string)
    field(:position, :integer)

    belongs_to(:publication, RichardBurton.Publication)

    timestamps()
  end

  @doc false
  def changeset(reference, attrs \\ %{}) do
    reference
    |> cast(attrs, [:content, :position])
    |> validate_required([:content])
  end

  @doc ~S"""
  Turn the flat wire shape (an ordered list of free-text strings) into the nested
  child maps `cast_assoc(:references)` expects, assigning `position` from order.
  Blank rows are dropped so an empty editor row doesn't fail validation.

  ## Examples

    iex> RichardBurton.Reference.nest(["First source", "Second source"])
    [%{"content" => "First source", "position" => 0}, %{"content" => "Second source", "position" => 1}]

    iex> RichardBurton.Reference.nest(["A source", "  "])
    [%{"content" => "A source", "position" => 0}]

    A blank in the middle is dropped and positions stay contiguous — the entry
    after it is `1`, not `2`:

    iex> RichardBurton.Reference.nest(["First", "", "Second"])
    [%{"content" => "First", "position" => 0}, %{"content" => "Second", "position" => 1}]

    iex> RichardBurton.Reference.nest(nil)
    []
  """
  def nest(references) when is_list(references) do
    references
    |> Enum.reject(&blank?/1)
    |> Enum.with_index()
    |> Enum.map(fn {content, position} ->
      %{"content" => content, "position" => position}
    end)
  end

  def nest(_), do: []

  @doc ~S"""
  Reverse of `nest/1`: an ordered list of the reference strings. Accepts loaded
  child structs (ordered by `position`) or an already-flat list; anything else
  (nil, `%NotLoaded{}`) flattens to an empty list.

  ## Examples

    iex> RichardBurton.Reference.flatten([
    ...>   %RichardBurton.Reference{content: "Second", position: 1},
    ...>   %RichardBurton.Reference{content: "First", position: 0}
    ...> ])
    ["First", "Second"]

    iex> RichardBurton.Reference.flatten(nil)
    []
  """
  def flatten(references = [%Reference{} | _]) do
    references |> Enum.sort_by(& &1.position) |> Enum.map(& &1.content)
  end

  def flatten(references) when is_list(references), do: references
  def flatten(_), do: []

  defp blank?(value) do
    is_nil(value) or (is_binary(value) and String.trim(value) == "")
  end
end
