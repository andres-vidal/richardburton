defmodule RichardBurton.PublicationTest do
  @moduledoc """
  Tests for the Publication schema
  """

  use RichardBurton.DataCase

  alias RichardBurton.Publication
  alias RichardBurton.TranslatedBook
  alias RichardBurton.Util
  alias RichardBurton.Validation

  @valid_attrs %{
    "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
    "countries" => [%{"code" => "GB"}],
    "year" => 1886,
    "publishers" => [%{"name" => "Bickers & Son"}],
    "translated_book" => %{
      "authors" => [
        %{"name" => "Richard Burton"},
        %{"name" => "Isabel Burton"}
      ],
      "original_book" => %{
        "authors" => [
          %{"name" => "J. M. Pereira da Silva"}
        ],
        "title" => "Manuel de Moraes: crônica do século XVII"
      }
    }
  }

  @empty_attrs %{}
  @skeleton_attrs %{translated_book: %{original_book: %{}}}

  @empty_attrs_error_map %{
    title: :required,
    countries: :required,
    year: :required,
    publishers: :required,
    translated_book: :required
  }

  @skeleton_attrs_error_map %{
    title: :required,
    countries: :required,
    year: :required,
    publishers: :required,
    translated_book: %{
      authors: :required,
      original_book: %{authors: :required, title: :required}
    }
  }

  defp changeset(attrs = %{}) do
    Publication.changeset(%Publication{}, attrs)
  end

  defp change_valid(attrs = %{}) do
    changeset(Util.deep_merge_maps(@valid_attrs, attrs))
  end

  defp insert(attrs) do
    attrs |> changeset() |> Repo.insert()
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

    test "when countries is blank, is invalid" do
      refute change_valid(%{"countries" => ""}).valid?
    end

    test "when countries is nil, is invalid" do
      refute change_valid(%{"countries" => nil}).valid?
    end

    test "when countries is valid alpha3 code, is invalid" do
      refute change_valid(%{"countries" => "USA"}).valid?
    end

    test "when countries is invalid 3 digit code, is invalid" do
      refute change_valid(%{"countries" => "EUA"}).valid?
    end

    test "when countries is invalid 2 digit code, is invalid" do
      refute change_valid(%{"countries" => "XX"}).valid?
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

    test "when translated book is missing, is invalid" do
      refute changeset(Map.delete(@valid_attrs, "translated_book")).valid?
    end

    test "when translated book is invalid, is invalid" do
      refute change_valid(%{"translated_book" => %{"original_book" => nil}}).valid?
    end

    test "when translated book is nil, is invalid" do
      refute change_valid(%{"translated_book" => nil}).valid?
    end

    test "when a publication with the provided attributes already exists, is invalid" do
      {:ok, _} = insert(@valid_attrs)
      {:error, changeset} = insert(@valid_attrs)

      refute changeset.valid?
      assert :conflict == Validation.get_errors(changeset)
    end

    test "has no side effects" do
      assert Enum.empty?(TranslatedBook.all())
      changeset(@valid_attrs)
      assert Enum.empty?(TranslatedBook.all())
    end
  end

  describe "insert/1" do
    test "when inserting valid publications, returns {:ok, publication}" do
      result = Publication.insert(@valid_attrs)
      expected = {:ok, List.first(Publication.all())}
      assert expected == result
    end

    test "when inserting a duplicate publication, returns {:error, :conflict}" do
      insert(@valid_attrs)
      assert {:error, :conflict} = Publication.insert(@valid_attrs)
    end

    test "when inserting an empty publication, returns an error map with :required errors" do
      assert {:error, @empty_attrs_error_map} == Publication.insert(@empty_attrs)
    end

    test "when inserting an skeleton publication, returns a deep error map with :required errors" do
      assert {:error, @skeleton_attrs_error_map} == Publication.insert(@skeleton_attrs)
    end
  end

  describe "validate/1" do
    import Publication, only: [validate: 1]

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

    test "when validating an skeleton publication, returns a deep error map with :required errors" do
      assert {:error, @skeleton_attrs_error_map} == validate(@skeleton_attrs)
    end

    test "when a single field is invalid, returns the corresponding error map" do
      assert {:error, %{year: :integer}} = validate(Map.put(@valid_attrs, "year", "A"))
    end

    test "has no side effects" do
      assert Enum.empty?(TranslatedBook.all())

      validate(@valid_attrs)

      assert Enum.empty?(TranslatedBook.all())
    end
  end

  describe "insert_all/1" do
    import Publication, only: [insert_all: 1]

    test "when many valid publications are provided, inserts them" do
      assert [] == Publication.all()

      {:ok, publications} =
        insert_all([
          @valid_attrs,
          Map.put(@valid_attrs, "year", 1887),
          Map.put(@valid_attrs, "year", 1888),
          Map.put(@valid_attrs, "year", 1889),
          Map.put(@valid_attrs, "year", 1890)
        ])

      assert Publication.preload(publications) == Publication.all()
    end

    test "when invalid publications are provided, rolls back and returns the first error" do
      assert [] == Publication.all()

      {:error, description} =
        insert_all([
          @valid_attrs,
          @valid_attrs,
          Map.put(@valid_attrs, "year", 1888),
          Map.put(@valid_attrs, "year", 1889),
          Map.put(@valid_attrs, "year", 1890)
        ])

      assert {@valid_attrs, :conflict} = description

      {:error, description} =
        insert_all([
          @valid_attrs,
          Map.put(@valid_attrs, "year", 1888),
          @skeleton_attrs,
          Map.put(@valid_attrs, "year", 1889),
          Map.put(@valid_attrs, "year", 1890)
        ])

      assert {@skeleton_attrs, @skeleton_attrs_error_map} == description

      assert [] == Publication.all()
    end
  end

  describe "update/2" do
    alias RichardBurton.Factory

    setup do
      publication = Factory.build(:flat_publication) |> Factory.create()

      %{publication: publication}
    end

    test "updates a publication successfully", %{publication: publication} do
      attrs = Factory.build_attrs(:flat_publication) |> Map.take([:title, :year])

      assert {:ok, _} = Publication.update(publication, attrs)

      changes = publication |> Repo.reload() |> Map.take(Map.keys(attrs))

      assert changes == attrs
    end

    test "returns error on validation error", %{publication: publication} do
      attrs = %{title: ""}

      assert {:error, _} = Publication.update(publication, attrs)
    end

    test "updates related models fingerprints", %{publication: publication} do
      attrs =
        %{
          countries: "UY, ES, AR",
          publishers: Faker.Person.name(),
          original_authors: Faker.Person.name(),
          authors: Faker.Person.name(),
          original_title: publication.title
        }
        |> Publication.Codec.nest()

      fingerprint_attrs = [
        :countries_fingerprint,
        :publishers_fingerprint,
        :translated_book_fingerprint
      ]

      old_fingerprints = publication |> Map.take(fingerprint_attrs)

      assert {:ok, _} = Publication.update(publication, attrs)

      new_fingerprints = publication |> Repo.reload() |> Map.take(fingerprint_attrs)

      all_fingerprint_differ =
        fingerprint_attrs
        |> Enum.all?(fn key -> old_fingerprints[key] != new_fingerprints[key] end)

      assert all_fingerprint_differ
    end
  end
end
