defmodule RichardBurton.Author do
  @moduledoc """
  A name credited on a book: a translator of a translated book, or an author
  of an original book. Each name is stored once. See `RichardBurton.Name`.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias RichardBurton.Name
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

  @doc "Casts the `name`, which is required and unique among authors."
  def changeset(author, attrs \\ %{}) do
    author
    |> cast(attrs, [:name])
    |> validate_required([:name])
    |> unique_constraint([:name])
  end

  @doc "Nests author names into the maps the schema casts. See `RichardBurton.Name.nest/1`."
  defdelegate nest(authors), to: Name

  @doc "Flattens authors to their names. See `RichardBurton.Name.flatten/1`."
  defdelegate flatten(authors), to: Name
end
