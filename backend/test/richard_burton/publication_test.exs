defmodule RichardBurton.PublicationTest do
  @moduledoc """
  Tests for the Publication schema
  """

  use RichardBurton.DataCase

  alias RichardBurton.Country
  alias RichardBurton.Publication
  alias RichardBurton.Reference
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

  defp insert_publication(attrs \\ @valid_attrs) do
    {:ok, publication} = Publication.insert(attrs)
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
    test "updates the publication and returns {:ok, updated}" do
      publication = insert_publication()

      result = Publication.update(publication.id, Map.put(@valid_attrs, "title", "New Title"))

      assert {:ok, updated} = result
      assert updated.id == publication.id
      assert updated.title == "New Title"
      assert [%Publication{title: "New Title"}] = Publication.all()
    end

    test "editing a keyed field changes identity without a collision" do
      publication = insert_publication()

      result = Publication.update(publication.id, Map.put(@valid_attrs, "year", 2000))

      assert {:ok, updated} = result
      assert updated.id == publication.id
      assert updated.year == 2000
    end

    test "when the edit collides with another publication, returns {:error, :conflict}" do
      insert_publication()
      other = insert_publication(Map.put(@valid_attrs, "year", 1999))

      assert {:error, :conflict} == Publication.update(other.id, @valid_attrs)
    end

    test "re-saving the same attributes does not conflict with itself" do
      publication = insert_publication()

      assert {:ok, _} = Publication.update(publication.id, @valid_attrs)
    end

    test "when the attributes are invalid, returns an error map" do
      publication = insert_publication()

      result = Publication.update(publication.id, Map.put(@valid_attrs, "title", ""))
      assert {:error, %{title: :required}} = result
    end

    test "when the id does not exist, returns {:error, :not_found}" do
      assert {:error, :not_found} == Publication.update(999_999, @valid_attrs)
    end

    test "replaces the linked countries, dropping the old join row but keeping the shared country" do
      publication =
        insert_publication(
          Map.put(@valid_attrs, "countries", [%{"code" => "GB"}, %{"code" => "US"}])
        )

      {:ok, updated} = Publication.update(publication.id, @valid_attrs)

      # The publication now links only GB...
      assert ["GB"] == Enum.map(updated.countries, & &1.code)
      # ...but the shared US country row is untouched (only the join row was removed).
      assert ["GB", "US"] == Country.all() |> Enum.map(& &1.code) |> Enum.sort()
    end

    test "recomputes the fingerprint when an association changes" do
      publication = insert_publication()
      original_fingerprint = publication.countries_fingerprint

      {:ok, updated} =
        Publication.update(
          publication.id,
          Map.put(@valid_attrs, "countries", [%{"code" => "US"}])
        )

      assert ["US"] == Enum.map(updated.countries, & &1.code)
      # The stored fingerprint reflects the new country, not the stale one.
      refute updated.countries_fingerprint == original_fingerprint
      assert Country.fingerprint("US") == updated.countries_fingerprint
    end

    test "repoints the translated book when the original fields change, leaving the old one" do
      publication = insert_publication()
      assert 1 == length(TranslatedBook.all())

      {:ok, updated} =
        Publication.update(
          publication.id,
          put_in(@valid_attrs, ["translated_book", "original_book", "title"], "A different book")
        )

      assert "A different book" == updated.translated_book.original_book.title
      # The previous translated book is left behind
      assert 2 == length(TranslatedBook.all())
    end

    test "adds references, loaded in position order" do
      publication = insert_publication()

      {:ok, _} =
        Publication.update(
          publication.id,
          Map.put(@valid_attrs, "references", [
            %{"content" => "Second source", "position" => 1},
            %{"content" => "First source", "position" => 0}
          ])
        )

      # Re-fetch so the preload actually queries (an update returns the cast order,
      # in memory) — this exercises the has_many's `preload_order`.
      reloaded = Repo.get(Publication, publication.id) |> Publication.preload()
      assert ["First source", "Second source"] == Enum.map(reloaded.references, & &1.content)
    end

    test "loads many references in position order" do
      publication = insert_publication()

      # More than a couple, given out of order (positions descending), so ordering
      # can't pass by luck.
      references =
        0..5
        |> Enum.map(&%{"content" => "Source #{&1}", "position" => &1})
        |> Enum.reverse()

      {:ok, _} =
        Publication.update(publication.id, Map.put(@valid_attrs, "references", references))

      reloaded = Repo.get(Publication, publication.id) |> Publication.preload()

      assert Enum.map(0..5, &"Source #{&1}") == Enum.map(reloaded.references, & &1.content)
      assert 6 == length(reloaded.references)
    end

    test "keeps duplicate reference content as distinct rows" do
      publication = insert_publication()

      {:ok, updated} =
        Publication.update(
          publication.id,
          Map.put(@valid_attrs, "references", [
            %{"content" => "Same source", "position" => 0},
            %{"content" => "Same source", "position" => 1}
          ])
        )

      # Unlike countries/publishers/authors (deduplicated shared rows), references
      # are owned children: identical content persists as two separate rows.
      assert ["Same source", "Same source"] == Enum.map(updated.references, & &1.content)
      assert 2 == length(Repo.all(Reference))
    end

    test "replaces references wholesale, deleting the previous rows" do
      publication =
        insert_publication(
          Map.put(@valid_attrs, "references", [
            %{"content" => "Old source 1", "position" => 0},
            %{"content" => "Old source 2", "position" => 1},
            %{"content" => "Old source 3", "position" => 2}
          ])
        )

      {:ok, updated} =
        Publication.update(
          publication.id,
          Map.put(@valid_attrs, "references", [%{"content" => "New source", "position" => 0}])
        )

      # The owned children are replaced, not accumulated: every previous row is
      # gone, leaving only the new one.
      assert ["New source"] == Enum.map(updated.references, & &1.content)
      assert ["New source"] == Repo.all(Reference) |> Enum.map(& &1.content)
    end

    test "clears references when given an empty list" do
      publication =
        insert_publication(
          Map.put(@valid_attrs, "references", [%{"content" => "A source", "position" => 0}])
        )

      {:ok, updated} = Publication.update(publication.id, Map.put(@valid_attrs, "references", []))

      assert [] == updated.references
      assert [] == Repo.all(Reference)
    end

    test "leaves references untouched when the payload omits them" do
      publication =
        insert_publication(
          Map.put(@valid_attrs, "references", [%{"content" => "A source", "position" => 0}])
        )

      {:ok, updated} = Publication.update(publication.id, @valid_attrs)

      assert ["A source"] == Enum.map(updated.references, & &1.content)
    end
  end
end
