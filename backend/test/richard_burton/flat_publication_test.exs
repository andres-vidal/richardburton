defmodule RichardBurton.FlatPublicationTest do
  @moduledoc """
  Tests for the FlatPublication schema
  """
  use RichardBurton.DataCase

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.Util

  # A flat publication with string keys, as a request holds it.
  @valid_attrs Util.stringify_keys(flat_publication_attrs())

  @skeleton_attrs %{
    translated_book: %{
      authors: nil,
      original_book: %{
        authors: nil,
        title: nil
      }
    }
  }

  @empty_attrs %{}

  @empty_attrs_error_map %{
    title: :required,
    countries: :required,
    year: :required,
    publishers: :required,
    authors: :required,
    original_authors: :required,
    original_title: :required
  }

  defp changeset(attrs = %{}) do
    FlatPublication.changeset(%FlatPublication{}, attrs)
  end

  defp change_valid(attrs = %{}) do
    changeset(Util.deep_merge_maps(@valid_attrs, attrs))
  end

  # Returns what `Publication.insert/2` gives for `nested`, `:ok` or
  # `{:error, errors}`, and rolls the insert back.
  defp insert_result(nested) do
    rolled_back(fn ->
      case Publication.insert(nested) do
        {:ok, _publication} -> :ok
        error -> error
      end
    end)
  end

  describe "changeset/2" do
    test "when valid attributes are provided, is valid" do
      assert changeset(@valid_attrs).valid?
    end

    test "when title is blank, is invalid" do
      refute change_valid(%{"title" => ""}).valid?
    end

    test "when notes are blank, casts them as nil" do
      changeset = change_valid(%{"notes" => paragraphs([" \n ", ""])})

      assert changeset.valid?
      assert Ecto.Changeset.get_field(changeset, :notes) == nil
    end

    test "when title is nil, is invalid" do
      refute change_valid(%{"title" => nil}).valid?
    end

    test "when publishers is blank, is invalid" do
      refute change_valid(%{"publishers" => []}).valid?
    end

    test "when publishers is nil, is invalid" do
      refute change_valid(%{"publishers" => nil}).valid?
    end

    test "when year is nil, is invalid" do
      refute change_valid(%{"year" => nil}).valid?
    end

    test "when year is not numeric, is invalid" do
      refute change_valid(%{"year" => "abc"}).valid?
    end

    test "when year is a numeric string, is invalid" do
      assert change_valid(%{"year" => "2000"}).valid?
    end

    test "when year is a number, is invalid" do
      assert change_valid(%{"year" => 2000}).valid?
    end

    # A spreadsheet says what a person calls a country, not what the database
    # files it under.
    test "a country written by name or by a code readers use is filed under its own" do
      for {written, code} <- [
            {"UK", "GB"},
            {"AUS", "AU"},
            {"Brasil", "BR"},
            {"Estados Unidos", "US"},
            {"UK ", "GB"}
          ] do
        changeset = change_valid(%{"countries" => [written]})

        assert changeset.valid?, "#{written} was refused"
        assert get_change(changeset, :countries) == [code]
      end
    end

    test "a value naming no country is still refused, and says which" do
      changeset = change_valid(%{"countries" => ["Narnia"]})

      refute changeset.valid?
      assert %{countries: [message]} = errors_on(changeset)
      assert message =~ "Narnia"
    end

    # "São Martinho" is both Sint Maarten and Saint Martin. Picking one would be
    # a guess, and the record would be filed under a country nobody chose.
    test "a name two countries share is refused rather than guessed at" do
      refute change_valid(%{"countries" => ["São Martinho"]}).valid?
    end

    # The search would offer Brazil for "Braz". This decides where a record is
    # stored, so it requires the complete name.
    test "a name that is only begun is refused" do
      refute change_valid(%{"countries" => ["Braz"]}).valid?
    end

    # The whole point of filing it under the code: an import that says "UK" and
    # one that says "GB" are the same record, and the second is a duplicate.
    test "a record imported as UK is the record imported as GB" do
      publication = publication_fixture(%{countries: ["UK"]})

      codes =
        publication |> Repo.preload(:countries) |> Map.get(:countries) |> Enum.map(& &1.code)

      assert codes == ["GB"]

      assert {:error, :conflict} = Publication.insert(publication_attrs(%{countries: ["GB"]}))
    end
  end

  describe "validate/1" do
    import FlatPublication, only: [validate: 1]

    test "when validating valid publications, returns :ok" do
      # Another publication is stored, so the database is not empty.
      publication_fixture(%{title: "New title"})
      assert :ok == validate(@valid_attrs)
    end

    test "when validating a duplicate publication, returns {:error, :conflict}" do
      publication_fixture()
      assert {:error, :conflict} == validate(@valid_attrs)
    end

    test "when validating an empty publication, returns an error map with :required errors" do
      assert {:error, @empty_attrs_error_map} == validate(@empty_attrs)
    end

    test "when a single field is invalid, returns the corresponding error map" do
      assert {:error, %{year: :integer}} = validate(Map.put(@valid_attrs, "year", "A"))
    end

    test "when the text of the notes is longer than 10,000 characters, reports it as too long" do
      at_most = paragraphs([String.duplicate("a", 5_000), String.duplicate("a", 5_000)])
      too_long = paragraphs([String.duplicate("a", 5_000), String.duplicate("a", 5_001)])

      assert :ok == validate(Map.put(@valid_attrs, "notes", at_most))
      assert {:error, %{notes: :too_long}} == validate(Map.put(@valid_attrs, "notes", too_long))
    end

    test "when the notes are not rich text, reports them as malformed" do
      assert {:error, %{notes: :malformed}} ==
               validate(Map.put(@valid_attrs, "notes", "A note written as **Markdown**"))

      assert {:error, %{notes: :malformed}} ==
               validate(
                 Map.put(@valid_attrs, "notes", [
                   %{"type" => "paragraph", "children" => [%{"text" => "A", "color" => "red"}]}
                 ])
               )
    end

    test "generates results analog to those of Publication.insert/2 on valid attrs" do
      expected =
        @valid_attrs
        |> Publication.Codec.nest()
        |> insert_result()

      assert FlatPublication.validate(@valid_attrs) == expected
    end

    test "generates results analog to those of Publication.insert/2 on empty attrs" do
      {:error, expected} =
        @skeleton_attrs
        |> Publication.Codec.nest()
        |> insert_result()

      expected = {:error, Publication.Codec.flatten(expected)}

      {:error, actual} = FlatPublication.validate(@empty_attrs)

      actual = {:error, Util.stringify_keys(actual)}

      assert actual == expected
    end

    test "generates results analog to those of Publication.insert/2 on duplicate attrs" do
      publication_fixture()

      expected =
        @valid_attrs
        |> Publication.Codec.nest()
        |> insert_result()

      assert expected == FlatPublication.validate(@valid_attrs)
    end

    test "generates results analog to those of Publication.insert/2 on attrs with invalid types" do
      attrs =
        @valid_attrs
        |> Map.put("year", "AAAA")
        |> Map.put("title", 1234)

      expected =
        attrs
        |> Publication.Codec.nest()
        |> insert_result()

      assert expected == FlatPublication.validate(attrs)
    end

    test "refuses an attribute that holds the same entry twice, as the insert does" do
      for {attribute, entry} <- [
            {:publishers, "Noonday Press"},
            {:countries, "US"},
            {:authors, "Helen Caldwell"},
            {:original_authors, "Machado de Assis"}
          ] do
        attrs = Map.put(@valid_attrs, Atom.to_string(attribute), [entry, entry])

        assert {:error, %{attribute => :duplicate}} == validate(attrs)
        assert validate(attrs) == attrs |> Publication.Codec.nest() |> insert_result()
      end
    end

    test "compares countries by code, so a country and its code are the same entry" do
      assert {:error, %{countries: :duplicate}} ==
               validate(Map.put(@valid_attrs, "countries", ["GB", "UK"]))
    end

    test "refuses an attribute with a blank entry among others" do
      for attribute <- [:publishers, :countries, :authors, :original_authors],
          blank <- ["", "   "] do
        attrs = Map.update!(@valid_attrs, Atom.to_string(attribute), &(&1 ++ [blank]))

        assert {:error, %{attribute => :required}} == validate(attrs), inspect({attribute, blank})
        assert {:error, _} = attrs |> Publication.Codec.nest() |> insert_result()
      end
    end

    test "reports a blank entry before a repeated one" do
      attrs = Map.put(@valid_attrs, "publishers", ["Noonday Press", "Noonday Press", ""])

      assert {:error, %{publishers: :required}} == validate(attrs)
    end
  end

  describe "validate/2" do
    import FlatPublication, only: [validate: 2]

    test "excludes the given id, so the row being edited is not a conflict with itself" do
      publication = publication_fixture()

      assert :ok == validate(@valid_attrs, publication.id)
    end

    test "still reports a conflict when a different row matches the attributes" do
      conflicting = publication_fixture()
      other = publication_fixture(%{title: "Another title"})

      # Excluding `other` does not hide the collision with `conflicting`.
      assert conflicting.id != other.id
      assert {:error, :conflict} == validate(@valid_attrs, other.id)
    end

    test "with a nil id, behaves like validate/1" do
      publication_fixture()

      assert {:error, :conflict} == validate(@valid_attrs, nil)
    end
  end

  describe "validate_all/2" do
    test "returns each row's result in order" do
      stored = publication_fixture()
      new = Map.put(@valid_attrs, "year", 1887)
      invalid = Map.delete(@valid_attrs, "year")

      assert [:ok, {:error, %{year: :required}}, {:error, :conflict}] ==
               FlatPublication.validate_all([new, invalid, @valid_attrs])

      assert [:ok] == FlatPublication.validate_all([@valid_attrs], stored.id)
    end

    test "looks up the keys of every row with the same number of queries" do
      rows = fn n -> for year <- 1..n, do: Map.put(@valid_attrs, "year", 1800 + year) end

      {_results, few} = count_queries(fn -> FlatPublication.validate_all(rows.(2)) end)
      {_results, many} = count_queries(fn -> FlatPublication.validate_all(rows.(40)) end)

      assert few == many
    end

    test "sends no query when no row is valid" do
      assert {[{:error, _}], 0} =
               count_queries(fn -> FlatPublication.validate_all([@empty_attrs]) end)
    end
  end
end
