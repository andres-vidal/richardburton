defmodule RichardBurton.FlatPublication do
  @moduledoc """
  Schema for publications
  """
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query
  import RichardBurton.Identity, only: [fingerprint: 1]

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.Repo
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
    conflict =
      changeset
      |> same_publication()
      |> exclude_self(exclude_id)
      |> Repo.exists?()

    if conflict do
      {:error, :conflict}
    else
      :ok
    end
  end

  # Builds the query for the stored publications, not deleted, with the same
  # composite key as `changeset`: the same title and year, the same publishers
  # and countries, and the same translated book, which is the same translators
  # of the same original book. Each set of names is compared by its fingerprint,
  # so the order of the names does not matter.
  #
  # It reads the tables rather than the materialized view, or a publication
  # inserted since the last refresh would not count.
  defp same_publication(changeset) do
    [title, year, countries, publishers, translators, original_title, original_authors] =
      Enum.map(
        [:title, :year, :countries, :publishers, :authors, :original_title, :original_authors],
        &get_field(changeset, &1)
      )

    from(p in Publication,
      join: tb in assoc(p, :translated_book),
      join: ob in assoc(tb, :original_book),
      where: is_nil(p.deleted_at) and p.title == ^title and p.year == ^year,
      where: p.countries_fingerprint == fingerprint(^countries),
      where: p.publishers_fingerprint == fingerprint(^publishers),
      where: tb.authors_fingerprint == fingerprint(^translators),
      where: ob.title == ^original_title,
      where: ob.authors_fingerprint == fingerprint(^original_authors)
    )
  end

  # The row being re-validated during an edit must not count as a conflict with
  # itself; without an id (a fresh create) there is nothing to exclude.
  defp exclude_self(query, nil), do: query
  defp exclude_self(query, id), do: from(fp in query, where: fp.id != ^id)
end
