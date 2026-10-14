defmodule RichardBurton.OriginalBook do
  @moduledoc """
  An original book: a title and the authors who wrote it.

  Two original books with the same title and the same authors are the same
  book, and the database keeps only one (see `RichardBurton.Identity`).
  `authors_fingerprint` is the fingerprint of the authors' names, which the
  database writes, so the schema never writes it.
  """
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query
  import RichardBurton.Validation

  alias RichardBurton.Author
  alias RichardBurton.Name
  alias RichardBurton.OriginalBook
  alias RichardBurton.Repo
  alias RichardBurton.TranslatedBook

  @readable_attributes [:authors, :title]

  @derive {Jason.Encoder, only: @readable_attributes}
  schema "original_books" do
    field(:title, :string)
    field(:authors_fingerprint, :string, writable: :never)

    has_many(:translated_books, TranslatedBook)

    many_to_many(:authors, Author,
      join_through: "original_book_authors",
      preload_order: [asc: :name]
    )

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
  end

  @doc "Returns every original book, with its authors."
  def all do
    OriginalBook |> Repo.all() |> preload()
  end

  @doc """
  Returns the original books whose title or one of whose authors' names
  begins with `term`, as `search/2` with `:prefix` does. When none does, it
  returns the ones whose title or author's name resembles `term`, as
  `search/2` with `:fuzzy` does.
  """
  def search(term) when is_binary(term) do
    case search(term, :prefix) do
      [] -> search(term, :fuzzy)
      books -> books
    end
  end

  @doc """
  Returns the original books whose title or one of whose authors' names
  begins with `term`, with `:prefix`, or resembles it, with `:fuzzy`, ordered
  by title, with their authors.
  """
  def search(term, :prefix) when is_binary(term) do
    matching(
      dynamic(^Name.starts_with(:book, :title, term) or ^Name.starts_with(:author, :name, term))
    )
  end

  def search(term, :fuzzy) when is_binary(term) do
    matching(
      dynamic(^Name.similar_to(:book, :title, term) or ^Name.similar_to(:author, :name, term))
    )
  end

  # Returns the original books that match `condition`, with their authors,
  # ordered by title. A book is joined to each of its authors, so it is read
  # once however many of its authors match.
  defp matching(condition) do
    from(b in OriginalBook,
      as: :book,
      join: a in assoc(b, :authors),
      as: :author,
      where: ^condition,
      distinct: true,
      order_by: [asc: b.title]
    )
    |> Repo.all()
    |> preload()
  end

  @doc ~S"""
  Returns a map of a book's title and its authors' names. The authors must be
  loaded.

  ## Examples

    iex> RichardBurton.OriginalBook.flatten(%RichardBurton.OriginalBook{
    ...>   title: "Dom Casmurro",
    ...>   authors: [%RichardBurton.Author{name: "Machado de Assis"}]
    ...> })
    %{title: "Dom Casmurro", authors: ["Machado de Assis"]}
  """
  def flatten(book = %OriginalBook{}) do
    %{title: book.title, authors: Author.flatten(book.authors)}
  end

  # Preloads the authors of a book or a list of them.
  defp preload(data) do
    Repo.preload(data, :authors)
  end
end
