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

  @external_attributes [
    :authors,
    :countries,
    :original_authors,
    :original_title,
    :publishers,
    :source,
    :title,
    :year
  ]

  @derive {Jason.Encoder, only: @external_attributes}
  schema "flat_publications" do
    field(:title, :string)
    field(:year, :integer)
    field(:countries, :string)
    field(:authors, :string)
    field(:publishers, :string)
    field(:original_title, :string)
    field(:original_authors, :string)
    field(:source, :string)

    field(:countries_fingerprint, :string)
    field(:translated_book_fingerprint, :string)
    field(:publishers_fingerprint, :string)
  end

  @doc false
  def changeset(flat_publication, attrs) do
    flat_publication
    |> cast(attrs, @external_attributes)
    |> validate_required(@external_attributes)
    |> Country.validate_countries()
    |> Country.link_fingerprint()
    |> Publisher.link_fingerprint()
    |> TranslatedBook.link_fingerprint()
  end

  def all() do
    Repo.all(FlatPublication)
  end

  def validate(attrs) do
    %FlatPublication{} |> changeset(attrs) |> validate_changeset()
  end

  defp validate_changeset(changeset = %{valid?: false}) do
    {:error, Validation.get_errors(changeset)}
  end

  defp validate_changeset(changeset = %{valid?: true}) do
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

    query = from(fp in FlatPublication, where: ^where)

    if Repo.exists?(query) do
      {:error, :conflict}
    else
      :ok
    end
  end
end
