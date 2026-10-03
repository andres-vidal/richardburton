defmodule RichardBurton.FlatPublication do
  @moduledoc """
  Schema for publications
  """
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.Publisher
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook
  alias RichardBurton.Validation
  alias RichardBurton.Country

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

  # The fields that make up a publication's composite key, as the changeset
  # computes them.
  @key [
    :title,
    :year,
    :countries_fingerprint,
    :publishers_fingerprint,
    :translated_book_fingerprint
  ]

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

    field(:countries_fingerprint, :string)
    field(:translated_book_fingerprint, :string)
    field(:publishers_fingerprint, :string)

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
    |> Country.link_fingerprint()
    |> Publisher.link_fingerprint()
    |> TranslatedBook.link_fingerprint()
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

    if changeset.valid?, do: Enum.map(@key, &get_field(changeset, &1))
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
    where = Enum.map(@key, &{&1, get_field(changeset, &1)})

    # The conflict check runs on the write path and must read the live table, not
    # the materialized view, or a duplicate inserted since the last refresh would
    # pass. The composite key belongs to `publications` — the columns the partial
    # unique index covers — so the check queries that table directly.
    conflict =
      from(p in Publication, where: ^where, where: is_nil(p.deleted_at))
      |> exclude_self(exclude_id)
      |> Repo.exists?()

    if conflict do
      {:error, :conflict}
    else
      :ok
    end
  end

  # The row being re-validated during an edit must not count as a conflict with
  # itself; without an id (a fresh create) there is nothing to exclude.
  defp exclude_self(query, nil), do: query
  defp exclude_self(query, id), do: from(fp in query, where: fp.id != ^id)
end
