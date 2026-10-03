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
    |> validate_entries()
  end

  defp validate_any_values(changeset) do
    Enum.reduce(@multivalued_attributes, changeset, &validate_length(&2, &1, min: 1))
  end

  # Adds an error to each multivalued attribute whose entries the insert would
  # refuse: `:required` when an entry is blank, and otherwise `:duplicate` when
  # two entries are the same.
  #
  # Blank entries are looked for in the params, because `cast/3` drops empty
  # strings from a list. Repeated entries are looked for in the cast field after
  # `Country.resolve_countries/1`, so countries are compared by code.
  defp validate_entries(changeset) do
    Enum.reduce(@multivalued_attributes, changeset, &validate_entries(&2, &1))
  end

  # Checks the entries of `attribute` alone, as `validate_entries/1` describes.
  defp validate_entries(changeset, attribute) do
    given = Map.get(changeset.params, Atom.to_string(attribute))
    entries = get_field(changeset, attribute) || []

    cond do
      is_list(given) and Enum.any?(given, &blank?/1) ->
        add_error(changeset, attribute, "has a blank entry", validation: :required)

      length(Enum.uniq(entries)) < length(entries) ->
        add_error(changeset, attribute, "has duplicates", validation: :duplicate)

      true ->
        changeset
    end
  end

  # Returns whether an entry is missing, empty or only whitespace, which is what
  # `validate_required/2` treats as missing.
  defp blank?(entry), do: is_nil(entry) or (is_binary(entry) and String.trim(entry) == "")

  def all() do
    Repo.all(FlatPublication)
  end

  @doc """
  Returns the composite key of `attrs`, a flat publication, or nil when `attrs`
  is not valid. Two publications with the same key are the same publication,
  and the database stores only one of them.
  """
  def key(attrs) do
    changeset = changeset(%FlatPublication{}, attrs)

    if changeset.valid?, do: changeset |> apply_changes() |> Identity.publication_key()
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
