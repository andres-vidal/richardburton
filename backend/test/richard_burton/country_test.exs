defmodule RichardBurton.CountryTest do
  @moduledoc """
  Tests for the Country schema
  """
  use RichardBurton.DataCase
  doctest RichardBurton.Country

  alias RichardBurton.Country
  alias RichardBurton.Validation
  alias RichardBurton.Util

  defmodule WithStringCountries do
    use Ecto.Schema
    import Ecto.Changeset

    schema "with_countries" do
      field(:countries, :string)
    end

    def changeset(attrs = %{}) do
      %WithStringCountries{}
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

  describe "validate_countries/1" do
    test "when countries is valid alpha2 code, is valid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => "GB"}
        |> WithStringCountries.changeset()
        |> Country.validate_countries()

      assert valid
      assert errors == []
    end

    test "when countries is multiple, comma separated, valid codes, is valid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => "GB,US"}
        |> WithStringCountries.changeset()
        |> Country.validate_countries()

      assert valid
      assert errors == []
    end

    test "when countries is blank, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => ""}
        |> WithStringCountries.changeset()
        |> Country.validate_countries()

      refute valid
      assert errors == [countries: {"can't be blank", [validation: :required]}]
    end

    test "when countries is nil, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => nil}
        |> WithStringCountries.changeset()
        |> Country.validate_countries()

      refute valid
      assert errors == [countries: {"can't be blank", [validation: :required]}]
    end

    test "when countries is valid alpha3 code, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => "USA"}
        |> WithStringCountries.changeset()
        |> Country.validate_countries()

      refute valid
      assert errors == [countries: {"Invalid countries: USA", [validation: :alpha2]}]
    end

    test "when countries is invalid 3 digit code, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => "EUA"}
        |> WithStringCountries.changeset()
        |> Country.validate_countries()

      refute valid
      assert errors == [countries: {"Invalid countries: EUA", [validation: :alpha2]}]
    end

    test "when countries is multiple, comma separated, invalid codes, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => "USA,GBR"}
        |> WithStringCountries.changeset()
        |> Country.validate_countries()

      refute valid
      assert errors == [countries: {"Invalid countries: USA, GBR", [validation: :alpha2]}]
    end

    test "when countries has at least one invalid code, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => "USA,GB"}
        |> WithStringCountries.changeset()
        |> Country.validate_countries()

      refute valid
      assert errors == [countries: {"Invalid countries: USA", [validation: :alpha2]}]
    end

    test "when countries is invalid 2 digit code, is invalid" do
      %Ecto.Changeset{errors: errors, valid?: valid} =
        %{"countries" => "XX"}
        |> WithStringCountries.changeset()
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

      assert "GB, US" = Country.flatten(countries)
    end

    test "with a list of maps with atom keys, returns a list of maps with code key" do
      countries = [
        %{code: "GB"},
        %{code: "US"}
      ]

      assert "GB, US" = Country.flatten(countries)
    end

    test "with a list of Country structs, returns a list of maps with code key" do
      countries = [
        %Country{code: "GB"},
        %Country{code: "US"}
      ]

      assert "GB, US" = Country.flatten(countries)
    end
  end

  describe "nest/1" do
    test "with a comma separated string, returns a list of maps with code key" do
      countries = "GB, US"

      assert [%{"code" => "GB"}, %{"code" => "US"}] = Country.nest(countries)
    end
  end
end
