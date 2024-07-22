defmodule RichardBurton.Publication do
  @moduledoc """
  Schema for publications
  """
  use Ecto.Schema
  import Ecto.Changeset

  require Ecto.Query

  alias RichardBurton.Country
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

    belongs_to(:translated_book, TranslatedBook, on_replace: :nilify)

    many_to_many(:countries, Country, join_through: "publication_countries", on_replace: :delete)

    many_to_many(:publishers, Publisher,
      join_through: "publication_publishers",
      on_replace: :delete
    )

    timestamps()
  end

  @doc false
  def changeset(publication, attrs \\ %{})

  @doc false
  def changeset(publication, attrs = %__MODULE__{}) do
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

  def get!(id) do
    __MODULE__
    |> Repo.get!(id)
  end

  def all do
    __MODULE__
    |> Repo.all()
    |> preload
  end

  def preload(data) do
    Repo.preload(data, [
      :countries,
      :publishers,
      translated_book: [:authors, original_book: [:authors]]
    ])
  end

  def insert(attrs) do
    %__MODULE__{}
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

  def update(publication, attrs) do
    Repo.transaction(fn ->
      publication
      |> changeset(attrs)
      |> link_assocs()
      |> Repo.update()
      |> case do
        {:ok, record} -> record
        {:error, changeset} -> Repo.rollback(changeset)
      end
    end)
  end

  def validate(attrs) do
    Validation.validate(changeset(%__MODULE__{}, attrs), &link_assocs/1)
  end

  defp link_fingerprints(changeset) do
    changeset
    |> TranslatedBook.link_fingerprint()
    |> Country.link_fingerprint()
    |> Publisher.link_fingerprint()
  end

  defp link_assocs(changeset) do
    changeset
    |> maybe_link_assoc(:countries)
    |> maybe_link_assoc(:translated_book)
    |> maybe_link_assoc(:publishers)
  end

  def insert_all(attrs_list) do
    Repo.transaction(fn ->
      Enum.map(attrs_list, &insert_or_rollback/1)
    end)
  end

  defp maybe_link_assoc(changeset, assoc_key) do
    {:assoc, %{related: related}} = __MODULE__.__changeset__() |> Map.get(assoc_key)

    if Ecto.Changeset.changed?(changeset, assoc_key) do
      changeset |> related.link()
    else
      changeset
    end
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
