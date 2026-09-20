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
  The ISO alpha-2 code a value names, or nil where it names no country.

  A value names a country when it is written out as one of the names that
  country goes by: either ISO code, the name in either language, or one of the
  other names readers have for it. A spreadsheet saying "UK" or "AUS" is saying
  the United Kingdom and Australia, and is filed under `GB` and `AU`.

  The value has to be a complete name. "Braz" returns nil, even though the
  search would offer Brazil for it, because the search is suggesting and this is
  deciding where a record is stored. A half-written name that resolved to a
  country would file the record under a country nobody chose.

  A value two countries share also returns nil, for the same reason. "São
  Martinho" is both Sint Maarten and Saint Martin, and picking one of them would
  be a guess.

  ## Examples

    iex> RichardBurton.Country.code_for("UK")
    "GB"

    iex> RichardBurton.Country.code_for("Estados Unidos")
    "US"

    iex> RichardBurton.Country.code_for("Braz")
    nil
  """
  def code_for(value) when is_binary(value) do
    written = normalize(value)

    named =
      @countries
      |> Map.keys()
      |> Enum.filter(fn code -> Enum.any?(names_for(code), &(normalize(&1) == written)) end)

    case named do
      [code] -> code
      _ -> nil
    end
  end

  def code_for(_value), do: nil

  @doc """
  Files each country a changeset holds under the code that names it.

  A person writing a country down writes what they call it, and a bulk import
  carries whatever the spreadsheet said. A value naming exactly one country
  becomes that country's code; anything else is left as written, so
  `validate_countries/1` refuses it and says what it refused.

  This runs before the record is validated or fingerprinted, so two rows that
  say "UK" and "GB" are the same row rather than two.
  """
  def resolve_countries(changeset = %Ecto.Changeset{}) do
    case get_change(changeset, :countries) do
      nil -> changeset
      countries -> put_change(changeset, :countries, Enum.map(countries, &resolved/1))
    end
  end

  # A value as the code it names, or as written where it names no one country.
  defp resolved(value) when is_binary(value), do: code_for(value) || value
  defp resolved(value), do: value

  @doc """
  The codes of the countries a `country:` operator's value names.

  A name matched in full answers alone, and only where nothing matches in full
  does a name merely beginning with the value answer. Writing a country out
  therefore names that country and not the longer names it starts: `country:US`
  is the United States, not every country with a name beginning "us".

  A value no name begins answers with nothing, which is a filter nothing
  satisfies rather than one everything does.

  ## Examples

    iex> RichardBurton.Country.answering("Reino Unido")
    ["GB"]

    iex> RichardBurton.Country.answering("BRA")
    ["BR"]

    iex> RichardBurton.Country.answering("zzzz")
    []
  """
  def answering(value) when is_binary(value) do
    case normalize(value) do
      "" -> []
      normalized -> best_answering(normalized)
    end
  end

  def answering(_value), do: []

  # The countries that answer `normalized` as well as any of them does: those
  # matching it in full where any does, and otherwise those it begins the name
  # of. A country it only appears inside of does not answer it at all.
  defp best_answering(normalized) do
    named =
      @countries
      |> Map.keys()
      |> Enum.map(&{&1, rank(&1, normalized)})
      |> Enum.reject(fn {_code, rank} -> is_nil(rank) or rank > 1 end)

    case Enum.min_by(named, &elem(&1, 1), fn -> nil end) do
      nil -> []
      {_code, best} -> for {code, ^best} <- named, do: code
    end
  end

  @doc """
  The codes of the countries a term names outright.

  A country is named when one of the names it is called appears in the term as a
  run of consecutive words. "machado brazil" names Brazil, and "United States
  Kingdom" names the United States but not the United Kingdom, whose name it
  does not contain.

  The words have to be consecutive rather than merely present, which is how two
  countries that share a word are told apart: "Reino Unido" contains both words
  of the United Kingdom's Portuguese name in order, and shares only "Unido" with
  "Estados Unidos". Case, accents and punctuation are folded away first, so
  "paises baixos" names the same country "Países Baixos" does.

  A code names a country when the term writes it in capitals, or when the term
  is that code and nothing else. Two-letter codes often spell common words, and
  capitals are what tell the two apart: "machado DE" asks for Germany, while
  "machado de assis" uses "de" as a Portuguese preposition and asks for no
  country at all.

  ## Examples

    iex> RichardBurton.Country.named_in("machado brazil")
    ["BR"]

    iex> RichardBurton.Country.named_in("a study of translation")
    []
  """
  def named_in(term) when is_binary(term) do
    said = words(term)
    as_typed = split(term)

    @countries
    |> Map.keys()
    |> Enum.filter(&named?(&1, said, as_typed))
    |> Enum.sort()
  end

  def named_in(_term), do: []

  @doc """
  The codes of the countries a term reaches.

  A term is read in two passes. First `named_in/1` asks which countries the term
  names outright; if any does, those are the answer and nothing else is tried.
  So "Reino Unido" reaches the United Kingdom alone, and not the "Estados
  Unidos" it shares a word with, and "United States Kingdom" reaches the United
  States alone.

  Only when the term names no country does the second pass run, which treats the
  whole term as a name the reader has not finished typing. "United" reaches
  every country whose name begins with it.

  The order matters: a term that already says which country it means must not
  also reach the countries it only partly resembles.

  ## Examples

    iex> RichardBurton.Country.reached_by("machado brazil")
    ["BR"]

    iex> RichardBurton.Country.reached_by("United States Kingdom")
    ["US"]

    iex> RichardBurton.Country.reached_by("machado de assis")
    []
  """
  def reached_by(term) when is_binary(term) do
    case named_in(term) do
      [] -> term |> words() |> beginning()
      named -> named
    end
  end

  def reached_by(_term), do: []

  # Whether a term names this country: one of the names it is called appears in
  # `said` as a run of words, or the term says one of its codes.
  defp named?(code, said, as_typed) do
    Enum.any?(called(code), &run_of?(words(&1), said)) or coded?(code, said, as_typed)
  end

  # Whether a term says one of this country's codes. It counts when the term
  # writes the code in capitals, and when the term is that code and nothing
  # else, in whatever case.
  #
  # Two-letter codes often spell common words. "DE" is Germany's code and "de"
  # is a Portuguese preposition, so the capitals are the only thing separating
  # them: "machado DE" asks for Germany, "machado de assis" does not, and "de"
  # on its own asks for nothing but Germany because there is nothing else in it.
  defp coded?(code, said, as_typed) do
    codes = coded(code)

    Enum.any?(codes, &(&1 in as_typed)) or Enum.any?(codes, &(words(&1) == said))
  end

  # The countries whose names begin with `said`, treating the whole of it as a
  # name the reader has not finished typing.
  #
  # The fragment has to be the entire term. If any word of a longer term counted,
  # "machado de assis" would reach four countries, because "de" begins Germany's
  # name in German, Denmark's in English, and two more. A word sitting inside a
  # longer term is being used as a word, not as a country someone is partway
  # through typing.
  #
  # Codes are not tried here. A code is already a complete name, so `named?/3`
  # has settled it. The words arrive already folded.
  defp beginning([]), do: []

  defp beginning(said) do
    fragment = Enum.join(said, " ")

    @countries
    |> Map.keys()
    |> Enum.filter(fn code ->
      Enum.any?(called(code), &String.starts_with?(Enum.join(words(&1), " "), fragment))
    end)
    |> Enum.sort()
  end

  # What a country is called: its name in each language, and the other names
  # readers have for it.
  defp called(code) do
    country = Map.fetch!(@countries, code)

    [country["en"]["name"], country["pt"]["name"] | country["aliases"] || []]
    |> Enum.filter(&is_binary/1)
  end

  # The codes a country is filed under, rather than called by.
  defp coded(code) do
    [code, Map.fetch!(@countries, code)["alpha3"]] |> Enum.filter(&is_binary/1)
  end

  # Whether `name` appears in `said` as a run of consecutive words. A name of no
  # words is in nothing, rather than in everything.
  defp run_of?([], _said), do: false

  defp run_of?(name, said) do
    Enum.any?(0..(length(said) - length(name))//1, fn at ->
      Enum.slice(said, at, length(name)) == name
    end)
  end

  # The words of a phrase, as they compare. Split on everything that is neither
  # a letter nor a digit, so the quotes and colons a search term carries are not
  # read as part of a word, and a name written with a hyphen is the same two
  # words whichever side writes it.
  defp words(phrase) do
    phrase |> normalize() |> split()
  end

  # A phrase cut into words, left as it was written. What tells a code from the
  # word it spells is the capitals, so the code check reads this rather than the
  # folded form.
  defp split(phrase), do: String.split(phrase, ~r/[^\p{L}\p{N}]+/u, trim: true)

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

  def nest(countries) when is_list(countries),
    do: Enum.map(countries, &%{"code" => resolved(get_code(&1))})

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
