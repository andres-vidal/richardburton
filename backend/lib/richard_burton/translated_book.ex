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
  alias RichardBurton.Identity
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

  @doc """
  Returns the stored translated book of the same original book by the same
  translators as `attrs`, and inserts it when there is none. The original book
  and the translators are found, or inserted, first.
  """
  def find_or_insert!(attrs) do
    %TranslatedBook{}
    |> changeset(attrs)
    |> OriginalBook.link()
    |> Author.link()
    |> Repo.find_or_insert!(&stored_id/1, [:authors_fingerprint])
  end

  # Returns the id of the stored translated book with the key of `changeset`,
  # the same original book and the same translators' names, or nil when there is
  # none.
  defp stored_id(changeset) do
    original_book = get_field(changeset, :original_book)
    names = changeset |> get_field(:authors) |> Enum.map(&Author.get_name/1)

    Identity.translated_book_with_key(original_book.id, names)
  end

  def all() do
    TranslatedBook
    |> Repo.all()
    |> preload
  end

  def preload(data) do
    Repo.preload(data, [:authors, original_book: [:authors]])
  end

  def link(changeset = %{valid?: true}) do
    translated_book =
      changeset
      |> get_change(:translated_book)
      |> apply_changes()
      |> TranslatedBook.find_or_insert!()

    put_assoc(changeset, :translated_book, translated_book)
  end

  def link(changeset = %{valid?: false}), do: changeset
end
