defmodule RichardBurton.FlatPublication do
  @moduledoc """
  Schema for publications
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias RichardBurton.Country
  alias RichardBurton.FlatPublication
  alias RichardBurton.Identity
  alias RichardBurton.Repo
  alias RichardBurton.Validation

  @required_attributes [
    :title,
    :year,
    :countries,
    :publishers,
    :authors,
    :original_title,
    :original_authors
  ]

  # Writable but not required: a publication may legitimately have no provenance,
  # and the bulk CSV import doesn't carry it.
  @writable_attributes [:sources | @required_attributes]

  # The attributes that hold several values. An empty list is not "blank" to
  # `validate_required/2`, so saying a record has no countries at all takes a
  # length of its own.
  @multivalued_attributes [:countries, :publishers, :authors, :original_authors]

  # What answered a search: `excerpts` per field, `marked` per value. Both are
  # null outside a search.
  @readable_attributes [:id, :excerpts, :marked | @writable_attributes]

  @derive {Jason.Encoder, only: @readable_attributes}
  schema "flat_publications" do
    field(:title, :string)
    field(:year, :integer)
    field(:countries, {:array, :string})
    field(:authors, {:array, :string})
    field(:publishers, {:array, :string})
    field(:original_title, :string)
    field(:original_authors, {:array, :string})
    field(:sources, {:array, :string})

    field(:excerpts, :map, virtual: true)
    field(:marked, :map, virtual: true)
  end

  @doc false
  def changeset(flat_publication, attrs) do
    flat_publication
    |> cast(attrs, @writable_attributes)
    |> validate_required(@required_attributes)
    |> validate_any_values()
    |> Country.resolve_countries()
    |> Country.validate_countries()
  end

  defp validate_any_values(changeset) do
    Enum.reduce(@multivalued_attributes, changeset, &validate_length(&2, &1, min: 1))
  end

  def all() do
    Repo.all(FlatPublication)
  end

  def validate(attrs, exclude_id \\ nil) do
    %FlatPublication{} |> changeset(attrs) |> validate_changeset(exclude_id)
  end

  # An invalid changeset reports its own errors; a valid one is then checked
  # against the composite key, excluding the record being updated.
  defp validate_changeset(changeset = %{valid?: false}, _exclude_id) do
    {:error, Validation.get_errors(changeset)}
  end

  defp validate_changeset(changeset = %{valid?: true}, exclude_id) do
    if key_taken?(changeset, exclude_id), do: {:error, :conflict}, else: :ok
  end

  # Returns whether a stored publication that is not deleted already has the
  # composite key of `changeset`. The publication with `exclude_id` is left out,
  # so an edit does not count against itself.
  #
  # The lookup reads the publications table rather than the materialized view
  # behind this schema, so it also finds a publication inserted since the view
  # was last refreshed.
  defp key_taken?(changeset, exclude_id) do
    changeset
    |> apply_changes()
    |> Identity.publication_with_key(exclude_id)
    |> is_integer()
  end
end
