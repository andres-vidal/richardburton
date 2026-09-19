defmodule RichardBurton.Country do
  @moduledoc """
  Schema for countries
  """
  use Ecto.Schema
  import Ecto.Changeset

  alias RichardBurton.Country
  alias RichardBurton.Repo
  alias RichardBurton.Publication
  alias RichardBurton.Fingerprint

  # Names people search a country by, beyond the ones the ISO data carries:
  # abbreviations readers type that are not in the official or unofficial names.
  @extra_names %{
    "US" => ["USA", "EUA"],
    "GB" => ["UK"]
  }

  @derive {Jason.Encoder, only: [:code]}
  schema "countries" do
    field(:code, :string)

    # The names this country is searchable by, folded into the search index. Not
    # user input: derived from the code, so the reader can search "Reino Unido"
    # or "USA" and reach the record that stores "GB" or "US".
    field(:names, {:array, :string}, default: [])

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

  @doc """
  Every name a country is searchable by: its official name, the unofficial and
  translated names the ISO data carries (which is where "Reino Unido" and
  "Estados Unidos" come from), and a curated supplement of abbreviations the
  data lacks. Deduplicated, in no particular order — the search index folds them
  in, it does not display them.
  """
  def names_for(code) do
    iso =
      if Countries.exists?(:alpha2, code) do
        country = Countries.get(code)
        [country.name | Map.get(country, :unofficial_names) || []]
      else
        []
      end

    (iso ++ Map.get(@extra_names, code, []))
    |> Enum.filter(&is_binary/1)
    |> Enum.uniq()
  end

  # Derived index data, not editor input, so it is set where a country is
  # persisted rather than in the changeset — a changeset also shapes the codec's
  # nested form, which has no business carrying it.
  defp put_names(changeset = %Ecto.Changeset{valid?: true}) do
    case get_field(changeset, :code) do
      nil -> changeset
      code -> put_change(changeset, :names, names_for(code))
    end
  end

  defp put_names(changeset), do: changeset

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
    |> validate_length(:countries, min: 1)
    |> validate_change(:countries, fn :countries, countries ->
      case validate_countries(countries) do
        {:ok} -> []
        {:error, message} -> [countries: {message, [validation: :alpha2]}]
      end
    end)
  end

  def validate_countries(countries) when is_binary(countries) or is_list(countries) do
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
  def fingerprint(countries) when is_binary(countries), do: countries |> nest() |> fingerprint()

  def fingerprint(countries) when is_list(countries) do
    countries
    |> Enum.map(&get_code/1)
    |> Fingerprint.of_set()
  end

  def maybe_insert!(attrs) do
    %__MODULE__{}
    |> changeset(attrs)
    |> put_names()
    |> Repo.maybe_insert!([:code])
  end

  def all do
    Repo.all(Country)
  end

  def link(changeset = %{valid?: true}) do
    countries =
      changeset
      |> get_change(:countries)
      |> Enum.reject(&(&1.action == :replace))
      |> Enum.map(&apply_changes/1)
      |> Enum.map(&maybe_insert!/1)

    put_assoc(changeset, :countries, countries)
  end

  def link(changeset = %{valid?: false}), do: changeset

  def link_fingerprint(changeset = %Ecto.Changeset{valid?: true}) do
    countries_fingerprint =
      changeset
      |> get_field(:countries)
      |> fingerprint

    put_change(changeset, :countries_fingerprint, countries_fingerprint)
  end

  def link_fingerprint(changeset = %Ecto.Changeset{valid?: false}), do: changeset

  @doc ~S"""
  Nest country codes into the maps the schema casts.

  A list is the shape the client and the flat schema speak in; a
  comma-separated string is CSV's, and is split on the way through.

  ## Examples

    iex> RichardBurton.Country.nest(["BR", "US"])
    [%{"code" => "BR"}, %{"code" => "US"}]

    iex> RichardBurton.Country.nest("BR, US")
    [%{"code" => "BR"}, %{"code" => "US"}]
  """
  def nest(countries) when is_binary(countries) do
    countries |> String.split(",") |> Enum.map(&String.trim/1) |> nest()
  end

  def nest(countries) when is_list(countries), do: Enum.map(countries, &%{"code" => get_code(&1)})

  @doc ~S"""
  Flatten countries to the codes they are. A value that is not a list is
  returned unchanged.

  ## Examples

    iex> RichardBurton.Country.flatten([%{"code" => "BR"}, %{"code" => "US"}])
    ["BR", "US"]

    iex> RichardBurton.Country.flatten("BR")
    "BR"
  """
  def flatten(countries) when is_list(countries), do: Enum.map(countries, &get_code/1)
  def flatten(countries), do: countries

  def get_code(code) when is_binary(code), do: code
  def get_code(%Country{code: code}), do: code
  def get_code(%{"code" => code}), do: code
  def get_code(%{code: code}), do: code
end
