defmodule RichardBurton.OriginalBook do
  @moduledoc """
  Schema for original books
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias RichardBurton.Author
  alias RichardBurton.Repo
  alias RichardBurton.OriginalBook
  alias RichardBurton.TranslatedBook
  alias RichardBurton.Util

  @external_attributes [:authors, :title]

  @derive {Jason.Encoder, only: @external_attributes}
  schema "original_books" do
    field(:title, :string)
    field(:authors_fingerprint, :binary)

    has_many(:translated_books, TranslatedBook)

    many_to_many(:authors, Author, join_through: "original_book_authors")

    timestamps()
  end

  @doc false
  def changeset(original_book, attrs \\ %{})

  @doc false
  def changeset(original_book, attrs = %OriginalBook{}) do
    changeset(original_book, Map.from_struct(attrs))
  end

  @doc false
  def changeset(original_book, attrs) do
    original_book
    |> cast(attrs, [:title])
    |> cast_assoc(:authors, required: true)
    |> validate_required([:title])
    |> validate_length(:authors, min: 1)
    |> Author.link_fingerprint()
    |> unique_constraint(
      [:authors_fingerprint, :title],
      name: "original_books_composite_key"
    )
  end

  def maybe_insert!(attrs) do
    %OriginalBook{}
    |> changeset(attrs)
    |> Author.link()
    |> Repo.maybe_insert!([:authors_fingerprint, :title])
  end

  def all() do
    OriginalBook |> Repo.all() |> preload()
  end

  def preload(data) do
    Repo.preload(data, :authors)
  end

  def link(changeset = %{valid?: true}) do
    original_book =
      changeset
      |> get_change(:original_book)
      |> apply_changes()
      |> OriginalBook.maybe_insert!()

    put_assoc(changeset, :original_book, original_book)
  end

  def link(changeset = %{valid?: false}), do: changeset

  def fingerprint(%OriginalBook{title: title, authors_fingerprint: authors_fingerprint}) do
    [title, authors_fingerprint]
    |> Enum.join()
    |> Util.create_fingerprint()
  end

  def link_fingerprint(changeset = %Ecto.Changeset{valid?: true}) do
    original_book_fingerprint =
      changeset
      |> get_field(:original_book)
      |> fingerprint()

    put_change(changeset, :original_book_fingerprint, original_book_fingerprint)
  end

  def link_fingerprint(changeset = %Ecto.Changeset{valid?: false}), do: changeset
end
