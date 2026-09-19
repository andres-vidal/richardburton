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

  # Every country, by ISO alpha-2 code: its alpha-3 code, the name it is shown
  # by in each language the platform speaks, and the other names a reader might
  # type for it. This is the one place countries are named — the editor's field
  # and every page that shows a country read it from here, over the API, so a
  # country is searchable by the very name it is shown under.
  #
  # Read at compile time, since it is static data and every country insert asks
  # for it. `@external_resource` is what makes editing the file recompile this.
  @countries_path Path.join(:code.priv_dir(:richard_burton), "countries.json")
  @external_resource @countries_path
  @countries @countries_path |> File.read!() |> Jason.decode!()

  # The language countries are named in when the one asked for has no names.
  @default_locale "en"

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
  Every name a country is searchable by: both its ISO codes, the name it is
  shown under in each language, and the other names a reader might type for it.

  Deduplicated, in no particular order — the search index folds them in, it does
  not display them. A code the table does not hold answers with the code itself,
  so a country is always searchable by what is stored.

  ## Examples

    iex> RichardBurton.Country.names_for("NL") |> Enum.take(4)
    ["NL", "NLD", "Netherlands", "Países Baixos"]
  """
  def names_for(code) do
    case Map.get(@countries, code) do
      nil ->
        [code]

      country ->
        [code, country["alpha3"], country["en"]["name"], country["pt"]["name"]]
        |> Enum.concat(country["aliases"] || [])
        |> Enum.filter(&is_binary/1)
        |> Enum.uniq()
    end
  end

  @doc """
  Every country the platform knows, by ISO alpha-2 code, as the table holds it.
  """
  def all_known, do: @countries

  @doc """
  Every country the platform knows, named in `locale`, ordered by that name.

  The shape the editor's country field reads: the code is what a publication
  stores, the label is what a reader is shown. A locale the table has no names
  for is answered in the default one.
  """
  def known(locale \\ @default_locale) do
    language = language(locale)

    @countries
    |> Enum.map(fn {code, country} -> shown(code, country, language) end)
    |> Enum.sort_by(&normalize(&1.label))
  end

  @doc """
  The countries `term` finds, named in `locale`.

  A country is found by either of its ISO codes, by the name it is shown under
  in any language, or by one of the other names readers type for it — so "NL",
  "NLD", "Netherlands", "Países Baixos" and "Holanda" all reach the same one.

  Names that begin with the term come before names that merely contain it, and
  a name matched in full comes before both: one country's name can begin
  another's, and typing a name in full should not put it behind the longer names
  it starts.
  """
  def search(term, locale \\ @default_locale)

  def search(term, locale) when is_binary(term) do
    case normalize(term) do
      "" ->
        known(locale)

      normalized ->
        language = language(locale)

        @countries
        |> Enum.map(fn {code, country} ->
          {code, country, rank(code, normalized)}
        end)
        |> Enum.reject(fn {_, _, rank} -> is_nil(rank) end)
        |> Enum.sort_by(fn {_, country, rank} ->
          {rank, normalize(country[language]["name"])}
        end)
        |> Enum.map(fn {code, country, _} -> shown(code, country, language) end)
    end
  end

  # A country as both the things that travel: the code a publication stores, the
  # name a reader is shown, and the article that name takes in a sentence.
  defp shown(code, country, language) do
    named = country[language]
    %{id: code, label: named["name"], article: named["article"]}
  end

  # How well a country answers to a term, lower being better, or nil for one it
  # does not answer to at all. Every name it goes by is tried and the best
  # standing wins, so a country found by its code is not held back by an alias
  # that merely contains the term.
  defp rank(code, term) do
    code
    |> names_for()
    |> Enum.map(&standing(normalize(&1), term))
    |> Enum.reject(&is_nil/1)
    |> Enum.min(fn -> nil end)
  end

  defp standing(name, term) do
    cond do
      name == term -> 0
      String.starts_with?(name, term) -> 1
      String.contains?(name, term) -> 2
      true -> nil
    end
  end

  # A name as it compares: case folded, and stripped of the accents a reader
  # will not always type. "Países" and "paises" are the same name to a search.
  defp normalize(text) do
    text
    |> String.downcase()
    |> :unicode.characters_to_nfd_binary()
    |> String.replace(~r/[\x{0300}-\x{036f}]/u, "")
    |> String.trim()
  end

  # The language to name countries in, falling back the way the catalogue does.
  defp language(locale) when is_binary(locale) do
    if Map.has_key?(@countries["BR"], locale), do: locale, else: @default_locale
  end

  defp language(_), do: @default_locale

  # Derived index data rather than editor input, so it is set where a country is
  # persisted instead of in the changeset, which also shapes the codec's nested
  # form.
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
