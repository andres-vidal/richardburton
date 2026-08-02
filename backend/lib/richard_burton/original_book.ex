defmodule RichardBurton.OriginalBook do
  @moduledoc """
  Schema for original books
  """
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query
  import RichardBurton.Validation

  alias RichardBurton.Author
  alias RichardBurton.Repo
  alias RichardBurton.OriginalBook
  alias RichardBurton.TranslatedBook
  alias RichardBurton.Util

  @readable_attributes [:authors, :title]

  @derive {Jason.Encoder, only: @readable_attributes}
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
    |> validate_no_duplicates(:authors, :name, as: :original_authors)
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
    OriginalBook |> Repo.all() |> preload
  end

  @doc """
  The original books a term names, by their title or by one of their authors.

  A book is entered as a unit — a title and who wrote it — and looking it up
  should work from whichever half the person typing happens to know. Prefixes
  first, so what someone is part-way through typing wins; only when nothing
  starts that way does the search fall back to similar spellings.
  """
  def search(term) when is_binary(term) do
    case search(term, :prefix) do
      [] -> search(term, :fuzzy)
      books -> books
    end
  end

  def search(term, :prefix) when is_binary(term) do
    matching(
      dynamic(
        [b, a],
        ilike(b.title, ^"#{term}%") or ilike(a.name, ^"#{term}%")
      )
    )
  end

  def search(term, :fuzzy) when is_binary(term) do
    matching(
      dynamic(
        [b, a],
        fragment("similarity((?), (?)) > 0.3", b.title, ^term) or
          fragment("similarity((?), (?)) > 0.3", a.name, ^term)
      )
    )
  end

  # A book joined to its authors matches once per author, so the rows are
  # deduplicated before they are counted as answers.
  defp matching(condition) do
    from(b in OriginalBook,
      join: a in assoc(b, :authors),
      where: ^condition,
      distinct: true,
      order_by: [asc: b.title]
    )
    |> Repo.all()
    |> preload()
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
      |> fingerprint

    put_change(changeset, :original_book_fingerprint, original_book_fingerprint)
  end

  def link_fingerprint(changeset = %Ecto.Changeset{valid?: false}), do: changeset
end
