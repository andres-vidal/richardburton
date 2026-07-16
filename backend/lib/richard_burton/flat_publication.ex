defmodule RichardBurton.FlatPublication do
  @moduledoc """
  Schema for publications
  """
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publisher
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook
  alias RichardBurton.Validation
  alias RichardBurton.Country

  @writable_attributes [
    :title,
    :year,
    :countries,
    :publishers,
    :authors,
    :original_title,
    :original_authors
  ]

  @readable_attributes [:id | @writable_attributes]

  @derive {Jason.Encoder, only: @readable_attributes}
  schema "flat_publications" do
    field(:title, :string)
    field(:year, :integer)
    field(:countries, :string)
    field(:authors, :string)
    field(:publishers, :string)
    field(:original_title, :string)
    field(:original_authors, :string)

    field(:countries_fingerprint, :string)
    field(:translated_book_fingerprint, :string)
    field(:publishers_fingerprint, :string)
  end

  @doc false
  def changeset(flat_publication, attrs) do
    flat_publication
    |> cast(attrs, @writable_attributes)
    |> validate_required(@writable_attributes)
    |> Country.validate_countries()
    |> Country.link_fingerprint()
    |> Publisher.link_fingerprint()
    |> TranslatedBook.link_fingerprint()
  end

  def all() do
    Repo.all(FlatPublication)
  end

  def validate(attrs, exclude_id \\ nil) do
    %FlatPublication{} |> changeset(attrs) |> validate_changeset(exclude_id)
  end

  defp validate_changeset(changeset = %{valid?: false}, _exclude_id) do
    {:error, Validation.get_errors(changeset)}
  end

  defp validate_changeset(changeset = %{valid?: true}, exclude_id) do
    where =
      Enum.map(
        [
          :title,
          :year,
          :countries_fingerprint,
          :publishers_fingerprint,
          :translated_book_fingerprint
        ],
        &{&1, get_field(changeset, &1)}
      )

    conflict =
      from(fp in FlatPublication, where: ^where)
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
