defmodule RichardBurton.PublicationTest do
  @moduledoc """
  Tests for the Publication schema
  """

  use RichardBurton.DataCase

  alias RichardBurton.Country
  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.Publication.History
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

      # `Publication.all/0` asks for no order, so the database is free to return
      # the rows in any: what this asserts is which publications now exist, not
      # the order they came back in.
      by_id = &Enum.sort_by(&1, fn publication -> publication.id end)

      assert by_id.(Publication.preload(publications)) == by_id.(Publication.all())
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

  describe "duplicate entries in multi-value fields" do
    # Without validation these reach the join tables' unique indexes and raise
    # there, turning a data-entry slip into a 500.
    test "a repeated country is rejected" do
      attrs = Map.put(@valid_attrs, "countries", [%{"code" => "GB"}, %{"code" => "GB"}])

      assert {:error, %{countries: :duplicate}} = Publication.insert(attrs)
    end

    test "a repeated publisher is rejected" do
      attrs =
        Map.put(@valid_attrs, "publishers", [
          %{"name" => "Bickers & Son"},
          %{"name" => "Bickers & Son"}
        ])

      assert {:error, %{publishers: :duplicate}} = Publication.insert(attrs)
    end

    test "a repeated translator is rejected" do
      attrs =
        Util.deep_merge_maps(@valid_attrs, %{
          "translated_book" => %{
            "authors" => [%{"name" => "Richard Burton"}, %{"name" => "Richard Burton"}]
          }
        })

      # Nested errors collapse to their innermost map; translators keep the
      # flat name the client knows them by.
      assert {:error, %{authors: :duplicate}} = Publication.insert(attrs)
    end

    test "a repeated original author is rejected" do
      attrs =
        Util.deep_merge_maps(@valid_attrs, %{
          "translated_book" => %{
            "original_book" => %{
              "authors" => [
                %{"name" => "J. M. Pereira da Silva"},
                %{"name" => "J. M. Pereira da Silva"}
              ]
            }
          }
        })

      # Reported as `original_authors`, not `authors`: otherwise it would be
      # indistinguishable from a duplicate translator and point the admin at
      # the wrong column.
      assert {:error, %{original_authors: :duplicate}} = Publication.insert(attrs)
    end

    test "distinct entries in the same field are fine" do
      attrs = Map.put(@valid_attrs, "countries", [%{"code" => "GB"}, %{"code" => "US"}])

      assert {:ok, publication} = Publication.insert(attrs)
      assert 2 == length(publication.countries)
    end

    test "an edit that introduces a duplicate is rejected" do
      publication = insert_publication()
      attrs = Map.put(@valid_attrs, "countries", [%{"code" => "GB"}, %{"code" => "GB"}])

      assert {:error, %{countries: :duplicate}} = Publication.update(publication.id, attrs)
    end
  end

  describe "saving a publication unchanged" do
    test "records no history entry and leaves the record alone" do
      publication = insert_publication()

      assert {:ok, _} = Publication.update(publication.id, @valid_attrs)
      assert {:ok, _} = Publication.update(publication.id, @valid_attrs)

      # Only the creation; re-saving identical data is not an event.
      assert ["created"] == Enum.map(History.of(publication.id), & &1.action)
    end

    test "a real edit after a no-op save is still recorded" do
      publication = insert_publication()

      {:ok, _} = Publication.update(publication.id, @valid_attrs)
      {:ok, _} = Publication.update(publication.id, Map.put(@valid_attrs, "year", 1999))

      # Newest first, as the log reads everywhere.
      assert ["updated", "created"] == Enum.map(History.of(publication.id), & &1.action)
    end

    test "a reference-only edit is recorded, despite identical scalar fields" do
      publication = insert_publication()

      {:ok, _} =
        Publication.update(
          publication.id,
          Map.put(@valid_attrs, "references", [%{"content" => "A source", "position" => 0}])
        )

      assert ["updated", "created"] == Enum.map(History.of(publication.id), & &1.action)
    end
  end

  describe "delete/2" do
    test "soft-deletes: the flat view hides the publication but the row survives" do
      publication = insert_publication()
      # The flat view is materialized; a bare insert doesn't signal a refresh
      # (bulk callers do, once), so ask for one before reading it. Delete signals
      # its own, so the tombstone drops out without a second nudge.
      Publication.Index.Refresher.refresh()
      assert [_] = Repo.all(FlatPublication)

      assert {:ok, %Publication{}} = Publication.delete(publication.id)

      assert [] == Repo.all(FlatPublication)
      assert %Publication{deleted_at: %DateTime{}} = Repo.get(Publication, publication.id)
    end

    test "keeps shared entities and owned references" do
      publication =
        insert_publication(
          Map.put(@valid_attrs, "references", [%{"content" => "A source", "position" => 0}])
        )

      countries = Repo.all(Country)
      translated_books = Repo.all(TranslatedBook)

      {:ok, _} = Publication.delete(publication.id)

      # Nothing cascades: shared entities and the tombstone's references stay.
      assert countries == Repo.all(Country)
      assert translated_books == Repo.all(TranslatedBook)
      assert ["A source"] == Repo.all(Reference) |> Enum.map(& &1.content)
    end

    test "frees the composite key: the same record can be imported again" do
      publication = insert_publication()
      {:ok, _} = Publication.delete(publication.id)

      assert {:ok, reimported} = Publication.insert(@valid_attrs)
      assert reimported.id != publication.id
      Publication.Index.Refresher.refresh()

      # Exactly one live row; the tombstone stays underneath.
      assert [%{id: live_id}] = Repo.all(FlatPublication)
      assert live_id == reimported.id
      assert 2 == Repo.aggregate(Publication, :count)
    end

    test "returns :not_found for a missing or already-deleted publication" do
      publication = insert_publication()
      {:ok, _} = Publication.delete(publication.id)

      assert {:error, :not_found} = Publication.delete(publication.id)
      assert {:error, :not_found} = Publication.delete(-1)
    end

    test "a deleted publication cannot be updated" do
      publication = insert_publication()
      {:ok, _} = Publication.delete(publication.id)

      assert {:error, :not_found} = Publication.update(publication.id, @valid_attrs)
    end
  end

  describe "restore/2" do
    test "brings a deleted publication back into the flat view" do
      publication = insert_publication()
      {:ok, _} = Publication.delete(publication.id)
      assert [] == Repo.all(FlatPublication)

      assert {:ok, %Publication{}} = Publication.restore(publication.id)

      assert [%{id: id}] = Repo.all(FlatPublication)
      assert id == publication.id
      assert %Publication{deleted_at: nil} = Repo.get(Publication, publication.id)
    end

    test "returns :not_found for a live or missing publication" do
      publication = insert_publication()

      assert {:error, :not_found} = Publication.restore(publication.id)
      assert {:error, :not_found} = Publication.restore(-1)
    end
  end

  describe "merge/3" do
    # Two records of the same work, each holding something the other lacks.
    defp merge_pair do
      winner =
        insert_publication(
          @valid_attrs
          |> Map.put("countries", [%{"code" => "GB"}])
          |> Map.put("references", [%{"content" => "A source", "position" => 0}])
        )

      loser =
        insert_publication(
          @valid_attrs
          |> Map.put("title", "Manuel de Moraes: Another Printing")
          |> Map.put("countries", [%{"code" => "US"}])
          |> Map.put("publishers", [%{"name" => "Noonday Press"}])
          |> Map.put("references", [%{"content" => "Another source", "position" => 0}])
        )

      {winner, loser}
    end

    test "the winner keeps what names it and gains what the loser held" do
      {winner, loser} = merge_pair()

      assert {:ok, merged} = Publication.merge(winner.id, [loser.id])

      assert merged.id == winner.id
      assert merged.title == winner.title

      assert ["GB", "US"] == merged.countries |> Enum.map(& &1.code) |> Enum.sort()

      assert ["Bickers & Son", "Noonday Press"] ==
               merged.publishers |> Enum.map(& &1.name) |> Enum.sort()

      assert ["A source", "Another source"] ==
               merged.references |> Enum.map(& &1.content) |> Enum.sort()
    end

    test "a source both of them recorded is recorded once" do
      winner =
        insert_publication(
          Map.put(@valid_attrs, "references", [%{"content" => "A source", "position" => 0}])
        )

      loser =
        insert_publication(
          @valid_attrs
          |> Map.put("title", "Manuel de Moraes: Another Printing")
          |> Map.put("references", [%{"content" => "A source", "position" => 0}])
        )

      assert {:ok, merged} = Publication.merge(winner.id, [loser.id])

      assert ["A source"] == Enum.map(merged.references, & &1.content)
    end

    test "the losers leave the database, and the winner stays in it" do
      {winner, loser} = merge_pair()

      {:ok, _} = Publication.merge(winner.id, [loser.id])

      assert [%{id: live}] = Repo.all(FlatPublication)
      assert live == winner.id
      assert %Publication{deleted_at: %DateTime{}} = Repo.get(Publication, loser.id)
    end

    test "the merge is one entry, on the record that survived it" do
      {winner, loser} = merge_pair()

      {:ok, _} = Publication.merge(winner.id, [loser.id], "someone@example.com")

      assert [entry | _] = Publication.History.of(winner.id)
      assert entry.action == "merged"
      assert entry.actor == "someone@example.com"
      assert Publication.History.absorbed_ids(entry) == [loser.id]
    end

    test "a loser's own log gains nothing, and offers no undo while it is held" do
      {winner, loser} = merge_pair()
      before = Publication.History.of(loser.id)

      {:ok, _} = Publication.merge(winner.id, [loser.id])

      # Nothing happened *to* the loser that the merge does not already say.
      assert Enum.map(Publication.History.of(loser.id), & &1.version) ==
               Enum.map(before, & &1.version)

      # And nothing in its log can be undone while another record holds it —
      # the merge holds it, and the merge is what gives it back.
      assert Enum.all?(Publication.History.all(), fn entry ->
               entry.publication_id != loser.id or not entry.undoable
             end)
    end

    test "a record a merge absorbed is not in the trash to be restored" do
      {winner, loser} = merge_pair()
      {:ok, _} = Publication.merge(winner.id, [loser.id])

      refute Enum.any?(Publication.all_deleted(), &(&1.id == loser.id))

      # A record that is deleted after being merged into is there, though: the
      # trash lists what someone deleted, whatever happened to it before.
      {:ok, _} = Publication.delete(winner.id)
      assert Enum.any?(Publication.all_deleted(), &(&1.id == winner.id))
    end

    test "undoing a merge takes the whole thing back, under one entry" do
      {winner, loser} = merge_pair()

      countries_before =
        Publication.find(winner.id) |> Publication.Codec.flatten() |> Map.get(:countries)

      {:ok, _} = Publication.merge(winner.id, [loser.id])

      [merge | _] = Publication.History.of(winner.id)
      assert merge.undoable

      assert {:ok, _} = Publication.undo(winner.id, merge.version)

      # The record that left is back, and live.
      assert %Publication{deleted_at: nil} = Repo.get(Publication, loser.id)

      # The one that survived gave up what it had absorbed.
      assert Publication.find(winner.id) |> Publication.Codec.flatten() |> Map.get(:countries) ==
               countries_before

      # And the un-merge is one entry, naming what it gave back.
      assert [undone | _] = Publication.History.of(winner.id)
      assert undone.action == "unmerged"
      assert Publication.History.absorbed_ids(undone) == [loser.id]
    end

    test "an un-merge is itself undoable, which merges them again" do
      {winner, loser} = merge_pair()
      {:ok, _} = Publication.merge(winner.id, [loser.id])
      [merge | _] = Publication.History.of(winner.id)
      {:ok, _} = Publication.undo(winner.id, merge.version)

      [undone | _] = Publication.History.of(winner.id)
      assert undone.undoable

      assert {:ok, _} = Publication.undo(winner.id, undone.version)

      assert %Publication{deleted_at: %DateTime{}} = Repo.get(Publication, loser.id)
      assert [again | _] = Publication.History.of(winner.id)
      assert again.action == "merged"
    end

    test "a record given back by an un-merge is out of hiding, and in the index" do
      {winner, loser} = merge_pair()
      {:ok, _} = Publication.merge(winner.id, [loser.id])
      [merge | _] = Publication.History.of(winner.id)
      {:ok, _} = Publication.undo(winner.id, merge.version)

      # Not in the trash — nobody deleted it — but listed again.
      refute Enum.any?(Publication.all_deleted(), &(&1.id == loser.id))
      assert Enum.any?(Repo.all(FlatPublication), &(&1.id == loser.id))
    end

    test "refuses to merge a publication into itself" do
      {winner, _loser} = merge_pair()

      assert {:error, :self} = Publication.merge(winner.id, [winner.id])
    end

    test "refuses when a publication is not here" do
      {winner, loser} = merge_pair()
      {:ok, _} = Publication.delete(loser.id)

      assert {:error, :not_found} = Publication.merge(winner.id, [loser.id])
      assert {:error, :not_found} = Publication.merge(-1, [winner.id])
    end

    test "takes no merge that names nothing to merge in" do
      {winner, _loser} = merge_pair()

      assert_raise FunctionClauseError, fn -> Publication.merge(winner.id, []) end
    end

    test "surfaces a collision with a third publication rather than crashing" do
      {winner, loser} = merge_pair()

      # A third record already holds what the merged one would: the same title
      # and year, and the countries and publishers the merge would union.
      third =
        insert_publication(
          @valid_attrs
          |> Map.put("countries", [%{"code" => "GB"}, %{"code" => "US"}])
          |> Map.put("publishers", [
            %{"name" => "Bickers & Son"},
            %{"name" => "Noonday Press"}
          ])
        )

      assert {:error, :conflict} = Publication.merge(winner.id, [loser.id])

      # Nothing moved: the loser is still here and the third is untouched.
      assert is_nil(Repo.get(Publication, loser.id).deleted_at)
      assert %Publication{} = Repo.get(Publication, third.id)
    end
  end
end
