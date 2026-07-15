defmodule RichardBurton.FlatPublicationTest do
  @moduledoc """
  Tests for the FlatPublication schema
  """
  use RichardBurton.DataCase

  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.Util
  alias RichardBurton.Validation

  @valid_attrs %{
    "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
    "countries" => "GB",
    "year" => 1886,
    "publishers" => "Bickers & Son",
    "authors" => "Richard Burton, Isabel Burton",
    "original_authors" => "J. M. Pereira da Silva",
    "original_title" => "Manuel de Moraes: crônica do século XVII"
  }

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

  defp insert(attrs) do
    %Publication{} |> Publication.changeset(Publication.Codec.nest(attrs)) |> Repo.insert()
  end

  defp insert_publication(attrs) do
    {:ok, publication} = attrs |> Publication.Codec.nest() |> Publication.insert()
    publication
  end

  describe "changeset/2" do
    test "when valid attributes are provided, is valid" do
      assert changeset(@valid_attrs).valid?
    end

    test "when title is blank, is invalid" do
      refute change_valid(%{"title" => ""}).valid?
    end

    test "when title is nil, is invalid" do
      refute change_valid(%{"title" => nil}).valid?
    end

    test "when publishers is blank, is invalid" do
      refute change_valid(%{"publishers" => ""}).valid?
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

    test "when a publication with the provided attributes already exists, is invalid" do
      {:ok, _} = insert(@valid_attrs)
      {:error, changeset} = insert(@valid_attrs)

      refute changeset.valid?
      assert :conflict == Validation.get_errors(changeset)
    end
  end

  describe "validate/1" do
    import FlatPublication, only: [validate: 1]

    test "when validating valid publications, returns :ok" do
      # Insert a dummy publication to make sure the test passes on a non-empty database
      insert(Map.put(@valid_attrs, "title", "New title"))
      assert :ok == validate(@valid_attrs)
    end

    test "when validating a duplicate publication, returns {:error, :conflict}" do
      insert(@valid_attrs)
      assert {:error, :conflict} == validate(@valid_attrs)
    end

    test "when validating an empty publication, returns an error map with :required errors" do
      assert {:error, @empty_attrs_error_map} == validate(@empty_attrs)
    end

    test "when a single field is invalid, returns the corresponding error map" do
      assert {:error, %{year: :integer}} = validate(Map.put(@valid_attrs, "year", "A"))
    end

    test "generates results analog to those of Publication.validate/1 on valid attrs" do
      expected =
        @valid_attrs
        |> Publication.Codec.nest()
        |> Publication.validate()

      assert FlatPublication.validate(@valid_attrs) == expected
    end

    test "generates results analog to those of Publication.validate/1 on empty attrs" do
      {:error, expected} =
        @skeleton_attrs
        |> Publication.Codec.nest()
        |> Publication.validate()

      expected = {:error, Publication.Codec.flatten(expected)}

      {:error, actual} = FlatPublication.validate(@empty_attrs)

      actual = {:error, Util.stringify_keys(actual)}

      assert actual == expected
    end

    test "generates results analog to those of Publication.validate/1 on duplicate attrs" do
      insert(@valid_attrs)

      expected =
        @valid_attrs
        |> Publication.Codec.nest()
        |> Publication.validate()

      assert expected == FlatPublication.validate(@valid_attrs)
    end

    test "generates results analog to those of Publication.validate/1 on attrs with invalid types" do
      attrs =
        @valid_attrs
        |> Map.put("year", "AAAA")
        |> Map.put("title", 1234)

      expected =
        attrs
        |> Publication.Codec.nest()
        |> Publication.validate()

      assert expected == FlatPublication.validate(attrs)
    end
  end

  describe "validate/2" do
    import FlatPublication, only: [validate: 2]

    test "excludes the given id, so the row being edited is not a conflict with itself" do
      publication = insert_publication(@valid_attrs)

      assert :ok == validate(@valid_attrs, publication.id)
    end

    test "still reports a conflict when a different row matches the attributes" do
      conflicting = insert_publication(@valid_attrs)
      other = insert_publication(Map.put(@valid_attrs, "title", "Another title"))

      # Excluding `other` does not hide the collision with `conflicting`.
      assert conflicting.id != other.id
      assert {:error, :conflict} == validate(@valid_attrs, other.id)
    end

    test "with a nil id, behaves like validate/1" do
      insert_publication(@valid_attrs)

      assert {:error, :conflict} == validate(@valid_attrs, nil)
    end
  end
end
