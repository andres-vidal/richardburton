defmodule RichardBurton.Country do
  @moduledoc """
  Schema for countries
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias RichardBurton.Country
  alias RichardBurton.Repo
  alias RichardBurton.Publication
  alias RichardBurton.Util

  @derive {Jason.Encoder, only: [:code]}
  schema "countries" do
    field(:code, :string)

    many_to_many(:publications, Publication, join_through: "publication_countries")

    timestamps()
  end

  @doc false
  def changeset(country, attrs \\ %{})

  @doc false
  def changeset(country, attrs = %Country{}) do
    changeset(country, Map.from_struct(attrs))
  end

  @doc false
  def changeset(country, attrs) do
    country
    |> cast(attrs, [:code])
    |> validate_required([:code])
    |> validate_code()
    |> unique_constraint(:code)
  end

  def validate_code(changeset) do
    validate_change(changeset, :code, fn :code, code ->
      if Countries.exists?(:alpha2, code) do
        []
      else
        [code: {"Invalid ISO-3361-1 alpha2 country code: #{code}", [validation: :alpha2]}]
      end
    end)
  end

  def validate_countries(changeset = %Ecto.Changeset{}) do
    changeset
    |> validate_required([:countries])
    |> validate_change(:countries, fn :countries, countries ->
      case validate_countries(countries) do
        {:ok} -> []
        {:error, message} -> [countries: {message, [validation: :alpha2]}]
      end
    end)
  end

  def validate_countries(countries) when is_binary(countries) do
    invalid =
      countries
      |> nest()
      |> Enum.map(&changeset(%Country{}, &1))
      |> Enum.reject(fn cset -> cset.valid? end)

    message = "Invalid countries: #{Enum.map_join(invalid, ", ", &get_change(&1, :code))}"

    case invalid do
      [] -> {:ok}
      _ -> {:error, message}
    end
  end

  @spec fingerprint(binary() | maybe_improper_list()) :: binary()
  def fingerprint(countries) when is_binary(countries) do
    countries
    |> nest()
    |> Enum.map(fn %{"code" => code} -> %Country{code: code} end)
    |> fingerprint()
  end

  def fingerprint(countries) when is_list(countries) do
    countries
    |> Enum.map(fn %Country{code: code} -> code end)
    |> Enum.sort()
    |> Enum.join()
    |> Util.create_fingerprint()
  end

  def maybe_insert!(attrs) do
    %__MODULE__{}
    |> changeset(attrs)
    |> Repo.maybe_insert!([:code])
  end

  def all do
    Repo.all(Country)
  end

  def link(changeset = %{valid?: true}) do
    countries =
      changeset
      |> get_change(:countries)
      |> Enum.map(&apply_changes/1)
      |> Enum.map(&maybe_insert!/1)

    put_assoc(changeset, :countries, countries)
  end

  def link(changeset = %{valid?: false}), do: changeset

  def link_fingerprint(changeset = %Ecto.Changeset{valid?: true}) do
    countries_fingerprint =
      changeset
      |> get_field(:countries)
      |> fingerprint()

    put_change(changeset, :countries_fingerprint, countries_fingerprint)
  end

  def link_fingerprint(changeset = %Ecto.Changeset{valid?: false}), do: changeset

  def nest(countries) when is_binary(countries) do
    countries |> String.split(",") |> Enum.map(&%{"code" => String.trim(&1)})
  end

  def flatten(countries) when is_list(countries), do: Enum.map_join(countries, ", ", &get_code/1)
  def flatten(countries), do: countries

  def get_code(%Country{code: code}), do: code
  def get_code(%{"code" => code}), do: code
  def get_code(%{code: code}), do: code
end
