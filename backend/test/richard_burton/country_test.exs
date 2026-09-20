defmodule RichardBurton.CountryTest do
  @moduledoc """
  Tests for the Country schema
  """
  use RichardBurton.DataCase
  doctest RichardBurton.Country

  alias RichardBurton.Country
  alias RichardBurton.Validation
  alias RichardBurton.Util

  defmodule WithFlatCountries do
    use Ecto.Schema
    import Ecto.Changeset

    schema "with_countries" do
      field(:countries, {:array, :string})
    end

    def changeset(attrs = %{}) do
      %WithFlatCountries{}
      |> cast(attrs, [:countries])
    end
  end

  defmodule WithManyCountries do
    use Ecto.Schema
    import Ecto.Changeset

    schema "with_many_countries" do
      field(:countries_fingerprint, :string)
      has_many :countries, Country
    end

    def changeset(attrs) do
      %WithManyCountries{} |> cast(attrs, []) |> cast_assoc(:countries)
    end
  end

  @valid_attrs %{
    "code" => "GB"
  }

  defp changeset(attrs = %{}) do
    Country.changeset(%Country{}, attrs)
  end

  defp change_valid(attrs = %{}) do
    changeset(Util.deep_merge_maps(@valid_attrs, attrs))
  end

  defp insert(attrs) do
    %Country{} |> Country.changeset(attrs) |> Repo.insert()
  end

  defp insert!(attrs) do
    attrs |> changeset() |> Repo.insert!()
  end

  defp get_countries(changeset = %Ecto.Changeset{}) do
    changeset
    |> get_change(:countries)
    |> Enum.map(&apply_changes/1)
  end

  defp get_fingerprint(changeset = %Ecto.Changeset{}) do
    get_change(changeset, :countries_fingerprint)
  end

  describe "changeset/2" do
    test "when valid attributes are provided, is valid" do
      assert changeset(@valid_attrs).valid?
    end

    test "when code is blank, is invalid" do
      refute change_valid(%{"code" => ""}).valid?
    end

    test "when code is nil, is invalid" do
      refute change_valid(%{"code" => nil}).valid?
    end

    test "when code is valid alpha3 code, is invalid" do
      refute change_valid(%{"code" => "USA"}).valid?
    end

    test "when code is invalid 3 digit code, is invalid" do
      refute change_valid(%{"code" => "EUA"}).valid?
    end

    test "when code is invalid 2 digit code, is invalid" do
      refute change_valid(%{"code" => "XX"}).valid?
    end

    test "when a country with the provided attributes already exists, is invalid" do
      {:ok, _} = insert(@valid_attrs)
      {:error, changeset} = insert(@valid_attrs)

      refute changeset.valid?
      assert :conflict == Validation.get_errors(changeset)
    end
  end

  describe "names_for/1" do
    test "carries both ISO codes" do
      names = Country.names_for("NL")

      assert "NL" in names
      assert "NLD" in names
    end

    test "carries the name the country is shown under in each language" do
      names = Country.names_for("NL")

      assert "Netherlands" in names
      assert "Pa\u00edses Baixos" in names
    end

    test "carries the other names readers type for it" do
      assert "Holanda" in Country.names_for("NL")
      assert "USA" in Country.names_for("US")
      assert "EUA" in Country.names_for("US")
      assert "UK" in Country.names_for("GB")
    end

    test "an unknown code is searchable by the code itself" do
      assert ["XX"] == Country.names_for("XX")
    end
  end

  describe "search/2" do
    test "finds a country by either of its ISO codes" do
      assert [%{id: "NL"} | _] = Country.search("NL", "en")
      assert [%{id: "NL"} | _] = Country.search("NLD", "en")
    end

    test "finds a country by the name it is shown under in either language" do
      assert [%{id: "NL"} | _] = Country.search("Netherlands", "pt")
      assert [%{id: "NL"} | _] = Country.search("Pa\u00edses Baixos", "en")
    end

    test "finds a country by one of the other names readers type for it" do
      assert [%{id: "NL"}] = Country.search("Holanda", "pt")
      assert [%{id: "US"} | _] = Country.search("EUA", "pt")
    end

    test "an accent a reader leaves out still finds the country" do
      assert [%{id: "NL"} | _] = Country.search("paises baixos", "pt")
    end

    test "names it in the language asked for" do
      assert [%{id: "NL", label: "Pa\u00edses Baixos"} | _] = Country.search("NL", "pt")
      assert [%{id: "NL", label: "Netherlands"} | _] = Country.search("NL", "en")
    end

    test "carries the article the name takes, for a sentence that places it" do
      assert [%{id: "NL", article: "os"} | _] = Country.search("NL", "pt")
      assert [%{id: "BR", article: nil} | _] = Country.search("BR", "en")
    end

    test "a name typed in full comes before the longer names it begins" do
      assert [%{id: "US"} | _] = Country.search("United States", "en")
    end

    test "an empty term finds every country" do
      assert length(Country.search("", "en")) == length(Country.known("en"))
    end

    test "a term nothing answers to finds nothing" do
      assert [] == Country.search("zzzzz", "en")
    end
  end

  describe "answering/1" do
    test "a name written in full names that country alone" do
      assert Country.answering("US") == ["US"]
      assert Country.answering("USA") == ["US"]
      assert Country.answering("Brasil") == ["BR"]
      assert Country.answering("Holanda") == ["NL"]
      assert Country.answering("Reino Unido") == ["GB"]
    end

    # "BR" begins "Britain", which the United Kingdom goes by, but it *is*
    # Brazil's code. A country written out reaches itself and not the longer
    # names it starts.
    test "a name written in full beats the longer names it begins" do
      assert Country.answering("BR") == ["BR"]
    end

    test "a name only begun reaches every country it could still become" do
      begun = Country.answering("United")

      assert "US" in begun
      assert "GB" in begun
    end

    test "a value no name answers to names nothing" do
      assert Country.answering("zzzzqqqq") == []
      assert Country.answering("") == []
    end
  end

  describe "named_in/1" do
    test "a term naming a country alongside something else still names it" do
      assert Country.named_in("machado brazil") == ["BR"]
    end

    # "United States Kingdom" holds the name "United States" as a run of words
    # and "United Kingdom" not at all, so the two countries are told apart even
    # though each shares a word with the term.
    test "a name has to appear as a run of words, not as words scattered about" do
      assert Country.named_in("United States Kingdom") == ["US"]
      assert Country.named_in("Reino Unido") == ["GB"]
    end

    test "a term naming several countries names all of them" do
      assert Country.named_in("brasil e portugal") == ["BR", "PT"]
    end

    test "quotes and punctuation are not read as part of a name" do
      assert Country.named_in(~s("United Kingdom")) == ["GB"]
    end

    test "a term naming no country in full names none" do
      assert Country.named_in("United") == []
      assert Country.named_in("a study of translation") == []
    end

    test "either ISO code names the country it stands for" do
      assert Country.named_in("US") == ["US"]
      assert Country.named_in("GBR") == ["GB"]
      assert "US" in Country.named_in("machado USA")
    end

    # "de" is Germany's code and a Portuguese preposition. What tells them apart
    # is that a code is written as one.
    test "a code spelling a common word has to be written as a code" do
      assert Country.named_in("machado de assis") == []
      assert Country.named_in("machado DE") == ["DE"]
    end

    test "a term that is nothing but a code names it whatever the case" do
      assert Country.named_in("de") == ["DE"]
      assert Country.named_in("usa") == ["US"]
    end
  end

  describe "reached_by/1" do
    test "a term naming a country outright reaches that one alone" do
      assert Country.reached_by("machado brazil") == ["BR"]
      assert Country.reached_by("Reino Unido") == ["GB"]
      assert Country.reached_by("United States Kingdom") == ["US"]
    end

    test "a term naming none is read a word at a time" do
      reached = Country.reached_by("United")

      assert "US" in reached
      assert "GB" in reached
    end

    # A half-written name has to be the whole term: "de" begins four countries'
    # names, and is a Portuguese preposition besides.
    test "a word inside a longer term is a word, not a country half-typed" do
      assert Country.reached_by("machado de assis") == []
      assert Country.reached_by("machado united") == []
    end

    test "a code written as one is reached from anywhere in the term" do
      assert Country.reached_by("machado USA") == ["US"]
    end
  end

  describe "known/1" do
    test "names every country in the language asked for" do
      labels = Country.known("pt") |> Enum.map(& &1.label)

      assert "Alemanha" in labels
      assert "Pa\u00edses Baixos" in labels
      assert length(labels) == length(Country.known("en"))
    end

    test "orders them by the name that language calls them, accents aside" do
      labels = Country.known("pt") |> Enum.map(& &1.label)

      # "\u00c1frica do Sul" sorts under A, where a reader looks for it, rather
      # than after Z where its accented first letter would otherwise put it.
      assert Enum.find_index(labels, &(&1 == "Afeganist\u00e3o")) <
               Enum.find_index(labels, &(&1 == "\u00c1frica do Sul"))

      assert Enum.find_index(labels, &(&1 == "\u00c1frica do Sul")) <
               Enum.find_index(labels, &(&1 == "Alb\u00e2nia"))
    end

    test "a language it has no names for is answered in the default one" do
      assert Country.known("de") == Country.known("en")
    end
  end

  describe "validate_countries/1" do
    test "when countries is valid alpha2 code, is valid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => ["GB"]}
        |> WithFlatCountries.changeset()
        |> Country.validate_countries()

      assert valid
      assert errors == []
    end

    test "when countries is multiple, comma separated, valid codes, is valid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => ["GB", "US"]}
        |> WithFlatCountries.changeset()
        |> Country.validate_countries()

      assert valid
      assert errors == []
    end

    # No countries at all is an empty list, which is not "blank" — it is a
    # length. `Validation` reports both to the client as `:required`.
    test "when countries is blank, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => []}
        |> WithFlatCountries.changeset()
        |> Country.validate_countries()

      refute valid
      assert [countries: {_, opts}] = errors
      assert opts[:validation] == :length and opts[:kind] == :min and opts[:count] == 1
    end

    test "when countries is nil, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => nil}
        |> WithFlatCountries.changeset()
        |> Country.validate_countries()

      refute valid
      assert errors == [countries: {"can't be blank", [validation: :required]}]
    end

    test "when countries is valid alpha3 code, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => ["USA"]}
        |> WithFlatCountries.changeset()
        |> Country.validate_countries()

      refute valid
      assert errors == [countries: {"Invalid countries: USA", [validation: :alpha2]}]
    end

    test "when countries is invalid 3 digit code, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => ["EUA"]}
        |> WithFlatCountries.changeset()
        |> Country.validate_countries()

      refute valid
      assert errors == [countries: {"Invalid countries: EUA", [validation: :alpha2]}]
    end

    test "when countries is multiple, comma separated, invalid codes, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => ["USA", "GBR"]}
        |> WithFlatCountries.changeset()
        |> Country.validate_countries()

      refute valid
      assert errors == [countries: {"Invalid countries: USA, GBR", [validation: :alpha2]}]
    end

    test "when countries has at least one invalid code, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => ["USA", "GB"]}
        |> WithFlatCountries.changeset()
        |> Country.validate_countries()

      refute valid
      assert errors == [countries: {"Invalid countries: USA", [validation: :alpha2]}]
    end

    test "when countries is invalid 2 digit code, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => ["XX"]}
        |> WithFlatCountries.changeset()
        |> Country.validate_countries()

      refute valid
      assert errors == [countries: {"Invalid countries: XX", [validation: :alpha2]}]
    end
  end

  describe "maybe_insert/1" do
    test "when there is no country with the provided name, inserts it" do
      country = Country.maybe_insert!(@valid_attrs)

      assert [country] == Country.all()
    end

    test "when there is a country with the provided name, returns the pre-existent one" do
      insert(@valid_attrs)
      assert [preexistent_country] = Country.all()

      country = Country.maybe_insert!(@valid_attrs)

      assert preexistent_country == country
      assert [country] == Country.all()
    end

    test "stores the names the country is searchable by" do
      country = Country.maybe_insert!(@valid_attrs)

      assert "United Kingdom" in country.names
      assert "Reino Unido" in country.names
      assert "UK" in country.names
    end
  end

  describe "fingerprint/1" do
    test "given two different lists of countries, generates different fingerprints" do
      countries1 = [%Country{code: "GB"}, %Country{code: "US"}]
      countries2 = [%Country{code: "US"}, %Country{code: "IE"}]

      refute Country.fingerprint(countries1) == Country.fingerprint(countries2)
    end

    test "given two lists of countries with the same names, generates the same fingerprints" do
      countries1 = [%Country{code: "GB"}, %Country{code: "US"}]
      countries2 = [%Country{code: "GB"}, %Country{code: "US"}]

      assert Country.fingerprint(countries1) == Country.fingerprint(countries2)
    end

    test "given two lists of countries with the same and different order, generates the same fingerprints" do
      countries1 = [%Country{code: "GB"}, %Country{code: "US"}]
      countries2 = [%Country{code: "US"}, %Country{code: "GB"}]

      assert Country.fingerprint(countries1) == Country.fingerprint(countries2)
    end
  end

  describe "link/1" do
    test "links existing countries to changeset" do
      attrs = %{
        "countries" => [
          %{"code" => "GB"},
          %{"code" => "US"}
        ]
      }

      countries = Enum.map(attrs["countries"], &insert!/1)

      changeset =
        attrs
        |> WithManyCountries.changeset()
        |> Country.link()

      assert changeset.valid?
      assert countries == get_countries(changeset)
    end

    test "links non-existing countries to changeset, inserting them" do
      attrs = %{
        "countries" => [
          %{"code" => "GB"},
          %{"code" => "US"}
        ]
      }

      changeset =
        attrs
        |> WithManyCountries.changeset()
        |> Country.link()

      assert changeset.valid?
      assert Country.all() == get_countries(changeset)
    end

    test "has no side effects when changeset is invalid" do
      changeset =
        %{"countries" => [%{}]}
        |> WithManyCountries.changeset()
        |> Country.link()

      refute changeset.valid?
      assert Enum.empty?(Country.all())
    end
  end

  describe "link_fingerprint/1" do
    test "links fingerprint using country names to changeset" do
      attrs = %{
        "countries" => [
          %{"code" => "GB"},
          %{"code" => "US"}
        ]
      }

      changeset =
        attrs
        |> WithManyCountries.changeset()
        |> Country.link_fingerprint()

      assert changeset.valid?
      assert Country.fingerprint(get_countries(changeset)) == get_fingerprint(changeset)
    end

    test "does not link fingerprint to invalid changeset" do
      changeset =
        %{"countries" => [%{}]}
        |> WithManyCountries.changeset()
        |> Country.link_fingerprint()

      refute changeset.valid?
      assert is_nil(get_fingerprint(changeset))
    end
  end

  describe "flatten/1" do
    test "with a list of maps with string keys, returns a list of maps with code key" do
      countries = [
        %{"code" => "GB"},
        %{"code" => "US"}
      ]

      assert ["GB", "US"] = Country.flatten(countries)
    end

    test "with a list of maps with atom keys, returns a list of maps with code key" do
      countries = [
        %{code: "GB"},
        %{code: "US"}
      ]

      assert ["GB", "US"] = Country.flatten(countries)
    end

    test "with a list of Country structs, returns a list of maps with code key" do
      countries = [
        %Country{code: "GB"},
        %Country{code: "US"}
      ]

      assert ["GB", "US"] = Country.flatten(countries)
    end
  end

  describe "nest/1" do
    test "with a comma separated string, returns a list of maps with code key" do
      countries = "GB, US"

      assert [%{"code" => "GB"}, %{"code" => "US"}] = Country.nest(countries)
    end
  end
end
