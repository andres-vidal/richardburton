defmodule RichardBurton.TranslatedBook do
  @moduledoc """
  A translated book: an original book, and the people who translated it.

  Two translated books of the same original book by the same translators are
  the same book, and the database keeps only one (see
  `RichardBurton.Identity`). `authors_fingerprint` is the fingerprint of the
  translators' names, which the database writes, so the schema never writes it.
  """
  use Ecto.Schema
  import Ecto.Changeset
  import RichardBurton.Validation

  alias RichardBurton.Author
  alias RichardBurton.OriginalBook
  alias RichardBurton.Publication
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook

  @readable_attributes [:authors, :original_book]

  @derive {Jason.Encoder, only: @readable_attributes}
  schema "translated_books" do
    field(:authors_fingerprint, :string, writable: :never)

    has_many(:publications, Publication)

    belongs_to(:original_book, OriginalBook)

    many_to_many(:authors, Author,
      join_through: "translated_book_authors",
      preload_order: [asc: :name]
    )

    timestamps()
  end

  @doc false
  def changeset(translated_book, attrs \\ %{})

  @doc false
  def changeset(translated_book, attrs = %TranslatedBook{}) do
    changeset(translated_book, Map.from_struct(attrs))
  end

  @doc false
  def changeset(translated_book, attrs) do
    translated_book
    |> cast(attrs, [])
    |> cast_assoc(:authors, required: true)
    |> cast_assoc(:original_book, required: true)
    |> validate_length(:authors, min: 1)
    |> validate_no_duplicates(:authors, :name)
  end

  def all() do
    TranslatedBook
    |> Repo.all()
    |> preload
  end

  def preload(data) do
    Repo.preload(data, [:authors, original_book: [:authors]])
  end
end
