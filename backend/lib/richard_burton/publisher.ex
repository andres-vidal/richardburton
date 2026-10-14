defmodule RichardBurton.Publisher do
  @moduledoc """
  A publisher of publications. Each name is stored once. See
  `RichardBurton.Name`.
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias RichardBurton.Name
  alias RichardBurton.Publication

  @derive {Jason.Encoder, only: [:name]}
  schema "publishers" do
    field(:name, :string)

    many_to_many(:publications, Publication, join_through: "publication_publishers")

    timestamps()
  end

  @doc "Casts the `name`, which is required and unique among publishers."
  def changeset(publisher, attrs \\ %{}) do
    publisher
    |> cast(attrs, [:name])
    |> validate_required([:name])
    |> unique_constraint(:name)
  end

  @doc "Nests publisher names into the maps the schema casts. See `RichardBurton.Name.nest/1`."
  defdelegate nest(publishers), to: Name

  @doc "Flattens publishers to their names. See `RichardBurton.Name.flatten/1`."
  defdelegate flatten(publishers), to: Name
end
