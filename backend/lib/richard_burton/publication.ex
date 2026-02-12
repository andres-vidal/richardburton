defmodule RichardBurton.Publication do
  @moduledoc """
  Schema for publications
  """
  use Ecto.Schema
  import Ecto.Changeset

  require Ecto.Query

  alias RichardBurton.Country
  alias RichardBurton.Publication
  alias RichardBurton.Publisher
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook
  alias RichardBurton.Validation

  @external_attributes [:countries, :publishers, :title, :year, :translated_book]

  @derive {Jason.Encoder, only: @external_attributes}
  schema "publications" do
    field(:title, :string)
    field(:year, :integer)
    field(:translated_book_fingerprint, :string)
    field(:countries_fingerprint, :string)
    field(:publishers_fingerprint, :string)

    belongs_to(:translated_book, TranslatedBook)

    many_to_many(:countries, Country, join_through: "publication_countries")
    many_to_many(:publishers, Publisher, join_through: "publication_publishers")

    timestamps()
  end

  @doc false
  def changeset(publication, attrs \\ %{})

  @doc false
  def changeset(publication, attrs = %Publication{}) do
    changeset(publication, Map.from_struct(attrs))
  end

  @doc false
  def changeset(publication, attrs) do
    publication
    |> cast(attrs, [:title, :year])
    |> cast_assoc(:translated_book, required: true)
    |> cast_assoc(:countries, required: true)
    |> cast_assoc(:publishers, required: true)
    |> validate_length(:countries, min: 1)
    |> validate_required([:title, :year])
    |> unique_constraint(
      [
        :title,
        :year,
        :publishers_fingerprint,
        :countries_fingerprint,
        :translated_book_fingerprint
      ],
      name: "publications_composite_key"
    )
    |> link_fingerprints()
  end

  def all do
    Publication
    |> Repo.all()
    |> preload()
  end

  def preload(data) do
    Repo.preload(data, [
      :countries,
      :publishers,
      translated_book: [:authors, original_book: [:authors]]
    ])
  end

  def insert(attrs) do
    %Publication{}
    |> changeset(attrs)
    |> link_assocs()
    |> Repo.insert()
    |> case do
      {:ok, publication} ->
        {:ok, preload(publication)}

      {:error, changeset} ->
        {:error, Validation.get_errors(changeset)}
    end
  end

  def validate(attrs) do
    Validation.validate(changeset(%Publication{}, attrs), &link_assocs/1)
  end

  defp link_fingerprints(changeset) do
    changeset
    |> TranslatedBook.link_fingerprint()
    |> Country.link_fingerprint()
    |> Publisher.link_fingerprint()
  end

  defp link_assocs(changeset) do
    changeset
    |> Country.link()
    |> TranslatedBook.link()
    |> Publisher.link()
  end

  def insert_all(attrs_list) do
    Repo.transaction(fn ->
      Enum.map(attrs_list, &insert_or_rollback/1)
    end)
  end

  defp insert_or_rollback(attrs) do
    case insert(attrs) do
      {:ok, publication} ->
        publication

      {:error, errors} ->
        Repo.rollback({attrs, errors})
    end
  end
end
