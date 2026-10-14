defmodule RichardBurton.Publisher do
  @moduledoc """
  Schema for publishers
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias RichardBurton.Publisher
  alias RichardBurton.Name
  alias RichardBurton.Repo
  alias RichardBurton.Publication

  @derive {Jason.Encoder, only: [:name]}
  schema "publishers" do
    field(:name, :string)

    many_to_many(:publications, Publication, join_through: "publication_publishers")

    timestamps()
  end

  @doc false
  def changeset(publisher, attrs \\ %{})

  @doc false
  def changeset(publisher, attrs = %Publisher{}) do
    changeset(publisher, Map.from_struct(attrs))
  end

  @doc false
  def changeset(publisher, attrs) do
    publisher
    |> cast(attrs, [:name])
    |> validate_required([:name])
    |> unique_constraint(:name)
  end

  @doc "Returns every publisher."
  def all, do: Repo.all(Publisher)

  @doc "Returns the publishers found by `term`. See `RichardBurton.Name.search/2`."
  def search(term), do: Name.search(Publisher, term)

  @doc "Returns the publishers found by `term` in one pass. See `RichardBurton.Name.search/3`."
  def search(term, pass), do: Name.search(Publisher, term, pass)

  @doc "Nests publisher names into the maps the schema casts. See `RichardBurton.Name.nest/1`."
  defdelegate nest(publishers), to: Name

  @doc "Flattens publishers to their names. See `RichardBurton.Name.flatten/1`."
  defdelegate flatten(publishers), to: Name

  @doc "Returns the name of a publisher. See `RichardBurton.Name.get_name/1`."
  defdelegate get_name(publisher), to: Name
end
