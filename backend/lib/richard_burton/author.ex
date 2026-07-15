defmodule RichardBurton.Author do
  @moduledoc """
  Schema for authors
  """
  use Ecto.Schema
  import Ecto.Changeset
  import Ecto.Query

  alias RichardBurton.Author
  alias RichardBurton.Repo
  alias RichardBurton.OriginalBook
  alias RichardBurton.TranslatedBook
  alias RichardBurton.Util

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

  def maybe_insert!(attrs) do
    %__MODULE__{}
    |> changeset(attrs)
    |> Repo.maybe_insert!([:name])
  end

  def all do
    Repo.all(Author)
  end

  def link(changeset = %{valid?: true}) do
    authors =
      changeset
      |> get_change(:authors)
      |> Enum.map(&apply_changes/1)
      |> Enum.map(&Author.maybe_insert!/1)

    put_assoc(changeset, :authors, authors)
  end

  def link(changeset = %{valid?: false}), do: changeset

  def fingerprint(authors) when is_list(authors) do
    authors
    |> Enum.map(fn %Author{name: name} -> name end)
    |> Enum.sort()
    |> Enum.join()
    |> Util.create_fingerprint()
  end

  def link_fingerprint(changeset = %Ecto.Changeset{valid?: true}) do
    authors_fingerprint =
      changeset
      |> get_field(:authors)
      |> fingerprint

    put_change(changeset, :authors_fingerprint, authors_fingerprint)
  end

  def link_fingerprint(changeset = %Ecto.Changeset{valid?: false}), do: changeset

  @spec search(binary(), :fuzzy | :prefix) :: any()
  def search(term, :prefix) when is_binary(term) do
    from(a in Author, where: ilike(a.name, ^"#{term}%"))
    |> Repo.all()
  end

  def search(term, :fuzzy) when is_binary(term) do
    from(a in Author, where: fragment("similarity((?), (?)) > 0.3", a.name, ^term))
    |> Repo.all()
  end

  def search(term) when is_binary(term) do
    case search(term, :prefix) do
      [] -> search(term, :fuzzy)
      keywords when is_list(keywords) -> keywords
    end
  end

  def nest(authors) when is_binary(authors) do
    authors |> String.split(",") |> Enum.map(&%{"name" => String.trim(&1)})
  end

  def flatten(authors) when is_list(authors), do: Enum.map_join(authors, ", ", &get_name/1)
  def flatten(authors), do: authors

  def get_name(%Author{name: name}), do: name
  def get_name(%{"name" => name}), do: name
  def get_name(%{name: name}), do: name
end
