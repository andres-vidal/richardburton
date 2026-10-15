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

    test "when code is a lowercase alpha2 code, is invalid" do
      refute change_valid(%{"code" => "gb"}).valid?
    end

    # The country table decides which codes exist: Kosovo has a code there,
    # and the Netherlands Antilles keep theirs for the records that name them.
    test "when code is one the country table holds, is valid" do
      for code <- ["XK", "AN"] do
        assert change_valid(%{"code" => code}).valid?, code
      end
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

    test "carries the country's name in each language" do
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

    test "finds a country by its name in either language" do
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

    # "BR" begins "Britain", which the United Kingdom goes by, but "BR" is also
    # Brazil's code in full. A complete name wins over the longer names it is
    # only the start of.
    test "a complete name wins over the longer names it begins" do
      assert Country.answering("BR") == ["BR"]
    end

    test "a name only begun reaches every country it could still become" do
      begun = Country.answering("United")

      assert "US" in begun
      assert "GB" in begun
    end

    test "a value matching no name at all answers with nothing" do
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

    test "a term with no complete name in it names no country" do
      assert Country.named_in("United") == []
      assert Country.named_in("a study of translation") == []
    end

    test "either ISO code names the country it stands for" do
      assert Country.named_in("US") == ["US"]
      assert Country.named_in("GBR") == ["GB"]
      assert "US" in Country.named_in("machado USA")
    end

    # "DE" is Germany's code and "de" is a Portuguese preposition. The capitals
    # are the only thing separating them.
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

    test "a term naming no country is read as a name still being typed" do
      reached = Country.reached_by("United")

      assert "US" in reached
      assert "GB" in reached
    end

    # The fragment has to be the entire term. "de" begins four countries' names
    # and is also a Portuguese preposition, so counting any word of a longer term
    # would reach all four.
    test "a word sitting inside a longer term reaches nothing" do
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

    # The table's entries also hold keys such as "alpha3" and "aliases", which
    # are not languages.
    test "a locale that is not a language of the table is answered in English" do
      for locale <- ["de", "alpha3", "aliases", "numeric", nil] do
        assert Country.known(locale) == Country.known("en")
        assert Country.search("NL", locale) == Country.search("NL", "en")
      end
    end

    test "carries each country's numeric code, as three digits" do
      numeric = Map.new(Country.known("en"), &{&1.id, &1.numeric})

      assert numeric["US"] == "840"
      assert numeric["AU"] == "036"

      # ISO assigns Kosovo no numeric code.
      assert numeric["XK"] == nil
      assert Enum.count(numeric, fn {_, code} -> is_nil(code) end) == 1
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

    # No countries at all is an empty list, which fails the length check rather
    # than the required check. `Validation.get_errors/1` reports both as
    # `:required`.
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

    # A written record says what a person calls a country. Every name a country
    # goes by is filed under its own code, so these are the country rather than
    # a spelling of it to be refused.
    test "when countries is a name or a code readers use, is valid" do
      for written <- ["USA", "EUA", "UK", "AUS", "Brasil", "Estados Unidos"] do
        %Ecto.Changeset{valid?: valid} =
          %{"countries" => [written]}
          |> WithFlatCountries.changeset()
          |> Country.validate_countries()

        assert valid, "#{written} was refused"
      end
    end

    test "when countries is multiple names nothing answers to, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => ["Narnia", "Cimmeria"]}
        |> WithFlatCountries.changeset()
        |> Country.validate_countries()

      refute valid
      assert errors == [countries: {"Invalid countries: Narnia, Cimmeria", [validation: :alpha2]}]
    end

    test "when countries has at least one name nothing answers to, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => ["Narnia", "GB"]}
        |> WithFlatCountries.changeset()
        |> Country.validate_countries()

      refute valid
      assert errors == [countries: {"Invalid countries: Narnia", [validation: :alpha2]}]
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

  describe "flatten/1" do
    test "with a list of maps with string keys, returns their codes" do
      countries = [
        %{"code" => "GB"},
        %{"code" => "US"}
      ]

      assert ["GB", "US"] = Country.flatten(countries)
    end

    test "with a list of maps with atom keys, returns their codes" do
      countries = [
        %{code: "GB"},
        %{code: "US"}
      ]

      assert ["GB", "US"] = Country.flatten(countries)
    end

    test "with a list of Country structs, returns their codes" do
      countries = [
        %Country{code: "GB"},
        %Country{code: "US"}
      ]

      assert ["GB", "US"] = Country.flatten(countries)
    end
  end

  describe "nest/1" do
    test "returns a list of maps with a code key, filed under the code each names" do
      assert [%{"code" => "GB"}, %{"code" => "US"}] = Country.nest(["UK", "US"])
    end

    test "leaves an entry that is no country for the changeset to refuse" do
      assert [%{"code" => nil}, %{"code" => 1}] = Country.nest([%{}, 1])
    end
  end
end
