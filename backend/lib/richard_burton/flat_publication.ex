defmodule RichardBurton.FlatPublication do
  @moduledoc """
  A publication in its flat shape: the title, year, countries, publishers,
  translators (`authors`), original title, original authors, sources and
  notes side by side. Each list of countries, publishers, authors or sources
  holds names, country codes or source texts. The notes are rich text, as
  `RichardBurton.RichText` describes it, or nil.

  The schema reads the `flat_publications` materialized view, which holds one
  row for each publication that is not deleted, and which
  `RichardBurton.Publication.Index.Refresher` rebuilds after each write. It
  also validates a publication in this shape, without writing it.

  The view does not hold the notes, so `notes` is a virtual field. A
  publication read from the view has nil notes, whatever notes it has, unless
  the query that read it selected them from the `publications` table.

  A flat publication is encoded as JSON with its id, its writable fields,
  `excerpts` and `marked`, as `json_fields/1` returns them. A publication
  loaded from the database is encoded without `notes` when they are nil,
  because a nil there may only mean that the query did not read them. Any
  other publication, such as one that `RichardBurton.Publication.Codec.flatten/1`
  returns, is encoded with its notes, nil included.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias RichardBurton.Country
  alias RichardBurton.FlatPublication
  alias RichardBurton.Identity
  alias RichardBurton.RichText
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

  # Writable but not required: a publication may legitimately have no provenance
  # or notes, and a CSV file may leave either column out.
  @writable_attributes [:sources, :notes | @required_attributes]

  # The attributes that hold several values. An empty list is not "blank" to
  # `validate_required/2`, so saying a record has no countries at all takes a
  # length of its own.
  @multivalued_attributes [:countries, :publishers, :authors, :original_authors]

  # What answered a search: `excerpts` per field, `marked` per value. Both are
  # null outside a search.
  @readable_attributes [:id, :excerpts, :marked | @writable_attributes]

  schema "flat_publications" do
    field(:title, :string)
    field(:year, :integer)
    field(:countries, {:array, :string})
    field(:authors, {:array, :string})
    field(:publishers, {:array, :string})
    field(:original_title, :string)
    field(:original_authors, {:array, :string})
    field(:sources, {:array, :string})
    field(:notes, RichText, virtual: true)

    field(:excerpts, :map, virtual: true)
    field(:marked, :map, virtual: true)
  end

  @doc false
  def changeset(flat_publication, attrs) do
    flat_publication
    |> cast(attrs, @writable_attributes)
    |> validate_required(@required_attributes)
    |> validate_any_values()
    |> Validation.validate_notes()
    |> Country.resolve_countries()
    |> Country.validate_countries()
    |> validate_entries()
  end

  # Adds a `:required` error to each multivalued attribute that holds no
  # value.
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

  @doc """
  Returns the fields of `publication` that its JSON holds, as a map, as the
  module doc describes.
  """
  def json_fields(publication = %FlatPublication{__meta__: %{state: :loaded}, notes: nil}) do
    Map.take(publication, @readable_attributes -- [:notes])
  end

  def json_fields(publication = %FlatPublication{}),
    do: Map.take(publication, @readable_attributes)

  # Encodes a flat publication as the map that `json_fields/1` returns.
  defimpl Jason.Encoder do
    def encode(publication, opts) do
      publication |> RichardBurton.FlatPublication.json_fields() |> Jason.Encode.map(opts)
    end
  end

  @doc """
  Validates `attrs` as `validate_all/2` validates each entry of a list.
  """
  def validate(attrs, exclude_id \\ nil) do
    [result] = validate_all([attrs], exclude_id)
    result
  end

  @doc """
  Validates each of `attrs_list` without writing anything, and returns the
  results in order.

  A result is `{:error, errors}` when the attrs are invalid, `{:error,
  :conflict}` when a stored publication that is not deleted has their
  composite key, and `:ok` otherwise. The publication with the id
  `exclude_id` is left out of the key check, so an edit does not count against
  itself. The keys are looked up with one query for the whole list.

  The lookup reads the publications table rather than the materialized view
  behind this schema, so it also finds a publication inserted since the view
  was last refreshed. Each entry is checked against the stored publications
  only, not against the other entries. `Publication.Duplicates.resemblances/1`
  reports an entry that repeats an earlier one.
  """
  def validate_all(attrs_list, exclude_id \\ nil) do
    changesets = Enum.map(attrs_list, &changeset(%FlatPublication{}, &1))

    stored_ids =
      for(changeset <- changesets, changeset.valid?, do: apply_changes(changeset))
      |> Identity.publications_with_keys(exclude_id)

    {results, []} =
      Enum.map_reduce(changesets, stored_ids, fn
        changeset = %{valid?: false}, stored_ids ->
          {{:error, Validation.get_errors(changeset)}, stored_ids}

        _changeset, [nil | stored_ids] ->
          {:ok, stored_ids}

        _changeset, [_id | stored_ids] ->
          {{:error, :conflict}, stored_ids}
      end)

    results
  end
end
