defmodule RichardBurton.Author do
  @moduledoc """
  Schema for authors
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias RichardBurton.Author
  alias RichardBurton.Name
  alias RichardBurton.Repo
  alias RichardBurton.OriginalBook
  alias RichardBurton.TranslatedBook

  @readable_attributes [:name]

  @derive {Jason.Encoder, only: @readable_attributes}
  schema "authors" do
    field(:name, :string)

    many_to_many(:translated_books, TranslatedBook, join_through: "translated_book_authors")
    many_to_many(:original_books, OriginalBook, join_through: "original_book_authors")

    timestamps()
  end

  @doc false
  def changeset(author, attrs \\ %{})

  @doc false
  def changeset(author, attrs = %Author{}) do
    changeset(author, Map.from_struct(attrs))
  end

  @doc false
  def changeset(author, attrs) do
    author
    |> cast(attrs, [:name])
    |> validate_required([:name])
    |> unique_constraint([:name])
  end

  @doc "Returns every author."
  def all, do: Repo.all(Author)

  @doc "Returns the authors found by `term`. See `RichardBurton.Name.search/2`."
  def search(term), do: Name.search(Author, term)

  @doc "Returns the authors found by `term` in one pass. See `RichardBurton.Name.search/3`."
  def search(term, pass), do: Name.search(Author, term, pass)

  @doc "Nests author names into the maps the schema casts. See `RichardBurton.Name.nest/1`."
  defdelegate nest(authors), to: Name

  @doc "Flattens authors to their names. See `RichardBurton.Name.flatten/1`."
  defdelegate flatten(authors), to: Name

  @doc "Returns the name of an author. See `RichardBurton.Name.get_name/1`."
  defdelegate get_name(author), to: Name
end
