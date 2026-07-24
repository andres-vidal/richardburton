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
  alias RichardBurton.Reference
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook
  alias RichardBurton.Validation

  @readable_attributes [:countries, :publishers, :title, :year, :translated_book]

  @derive {Jason.Encoder, only: @readable_attributes}
  schema "publications" do
    field(:title, :string)
    field(:year, :integer)
    field(:translated_book_fingerprint, :string)
    field(:countries_fingerprint, :string)
    field(:publishers_fingerprint, :string)

    belongs_to(:translated_book, TranslatedBook, on_replace: :nilify)

    many_to_many(:countries, Country,
      join_through: "publication_countries",
      on_replace: :delete
    )

    many_to_many(:publishers, Publisher,
      join_through: "publication_publishers",
      on_replace: :delete
    )

    # Owned provenance: replaced wholesale on edit (children carry no client id,
    # so cast_assoc treats every incoming entry as new), preloaded in order.
    has_many(:references, Reference,
      on_replace: :delete,
      preload_order: [asc: :position]
    )

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
    |> cast_assoc(:references)
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
    |> preload
  end

  def preload(data) do
    Repo.preload(data, [
      :countries,
      :publishers,
      :references,
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

  def update(id, attrs) do
    case Repo.get(Publication, id) do
      nil ->
        {:error, :not_found}

      publication ->
        publication
        |> preload()
        |> changeset(attrs)
        |> link_assocs()
        |> Repo.update()
        |> case do
          {:ok, updated} -> {:ok, preload(updated)}
          {:error, changeset} -> {:error, Validation.get_errors(changeset)}
        end
    end
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
    result =
      Repo.transaction(fn ->
        # Skip the per-statement search-index rebuild for the whole batch — the
        # trigger would otherwise rebuild both materialized views for every
        # inserted row. One rebuild below covers the entire transaction.
        Repo.query!("SET LOCAL richard_burton.skip_search_refresh = 'on'")
        Enum.map(attrs_list, &insert_or_rollback/1)
      end)

    case result do
      {:ok, _publications} ->
        refresh_search_index()
        result

      error ->
        # Rolled back: nothing changed, so the index needs no refresh.
        error
    end
  end

  defp refresh_search_index do
    Repo.query!("REFRESH MATERIALIZED VIEW search_documents")
    Repo.query!("REFRESH MATERIALIZED VIEW search_keywords")
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
