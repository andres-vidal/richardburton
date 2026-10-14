defmodule RichardBurton.PublicationTest do
  @moduledoc """
  Tests for the Publication schema and its write paths
  """

  use RichardBurton.DataCase

  alias RichardBurton.Country
  alias RichardBurton.FlatPublication
  alias RichardBurton.Publication
  alias RichardBurton.Publication.History
  alias RichardBurton.Source
  alias RichardBurton.TranslatedBook
  alias RichardBurton.Validation

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

  # Returns the changeset of `publication_attrs/0` with the nested `changes`
  # put in place of its own.
  defp change_valid(changes = %{}) do
    changeset(Map.merge(publication_attrs(), changes))
  end

  describe "changeset/2" do
    test "when valid attributes are provided, is valid" do
      assert changeset(publication_attrs()).valid?
    end

    test "when title is blank, is invalid" do
      refute change_valid(%{"title" => ""}).valid?
    end

    test "when title is nil, is invalid" do
      refute change_valid(%{"title" => nil}).valid?
    end

    test "when countries is blank, is invalid" do
      refute change_valid(%{"countries" => []}).valid?
    end

    test "when countries is nil, is invalid" do
      refute change_valid(%{"countries" => nil}).valid?
    end

    test "when countries is valid alpha3 code, is invalid" do
      refute change_valid(%{"countries" => ["USA"]}).valid?
    end

    test "when countries is invalid 3 digit code, is invalid" do
      refute change_valid(%{"countries" => ["EUA"]}).valid?
    end

    test "when countries is invalid 2 digit code, is invalid" do
      refute change_valid(%{"countries" => ["XX"]}).valid?
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

    test "when year is a numeric string, is valid" do
      assert change_valid(%{"year" => "2000"}).valid?
    end

    test "when year is a number, is valid" do
      assert change_valid(%{"year" => 2000}).valid?
    end

    test "when translated book is missing, is invalid" do
      refute changeset(Map.delete(publication_attrs(), "translated_book")).valid?
    end

    test "when translated book is invalid, is invalid" do
      refute change_valid(%{"translated_book" => %{"original_book" => nil}}).valid?
    end

    test "when translated book is nil, is invalid" do
      refute change_valid(%{"translated_book" => nil}).valid?
    end

    test "has no side effects" do
      assert Enum.empty?(Repo.all(TranslatedBook))
      changeset(publication_attrs())
      assert Enum.empty?(Repo.all(TranslatedBook))
    end
  end

  describe "comments" do
    @comments "A note in **bold**, with a [link](https://example.com).\n\n1. One\n2. Two"

    test "are stored as written, and the flat view carries them" do
      publication = publication_fixture(%{comments: @comments})

      assert Publication.find(publication.id).comments == @comments
      assert [%FlatPublication{comments: @comments}] = Repo.all(FlatPublication)
    end

    test "a blank value is stored as nil" do
      publication = publication_fixture(%{comments: @comments})

      assert {:ok, updated} =
               Publication.update(publication.id, publication_attrs(%{comments: "  \n "}))

      assert updated.comments == nil
      assert Publication.find(publication.id).comments == nil
    end

    test "an update without comments keeps the stored ones" do
      publication = publication_fixture(%{comments: @comments})

      assert {:ok, updated} =
               Publication.update(
                 publication.id,
                 publication_attrs(%{title: "Dom Casmurro: A Novel"})
               )

      assert updated.comments == @comments
    end

    test "comments longer than 10,000 characters are too long" do
      assert change_valid(%{"comments" => String.duplicate("a", 10_000)}).valid?

      assert %{comments: :too_long} ==
               Validation.get_errors(change_valid(%{"comments" => String.duplicate("a", 10_001)}))
    end

    test "are not part of the composite key" do
      publication_fixture(%{comments: @comments})

      assert {:error, :conflict} ==
               Publication.insert(publication_attrs(%{comments: "Another note."}))
    end

    test "a batch may hold rows with comments and rows without" do
      assert {:ok, [with_comments, without_comments]} =
               Publication.insert_all([
                 publication_attrs(%{comments: @comments}),
                 publication_attrs(%{year: 1954})
               ])

      assert with_comments.comments == @comments
      assert without_comments.comments == nil
    end

    test "a restore with changes can set them" do
      publication = publication_fixture()
      {:ok, _} = Publication.delete(publication.id)

      assert {:ok, _} =
               Publication.restore(
                 publication.id,
                 History.system_actor(),
                 publication_attrs(%{comments: @comments})
               )

      assert Publication.find(publication.id).comments == @comments
    end
  end

  describe "insert/1" do
    test "when inserting valid publications, returns {:ok, publication}" do
      result = Publication.insert(publication_attrs())
      expected = {:ok, List.first(Publication.all())}
      assert expected == result
    end

    test "when inserting a duplicate publication, returns {:error, :conflict}" do
      publication_fixture()
      assert {:error, :conflict} = Publication.insert(publication_attrs())
    end

    test "when inserting an empty publication, returns an error map with :required errors" do
      assert {:error, @empty_attrs_error_map} == Publication.insert(@empty_attrs)
    end

    test "when inserting an skeleton publication, returns a deep error map with :required errors" do
      assert {:error, @skeleton_attrs_error_map} == Publication.insert(@skeleton_attrs)
    end

    test "puts the publication in the index" do
      publication = publication_fixture()

      assert [%FlatPublication{id: id}] = Repo.all(FlatPublication)
      assert id == publication.id
    end
  end

  describe "all/0" do
    # Postgres writes an updated row as a new row version later in the table,
    # so a query without ORDER BY can return it after rows inserted later.
    test "lists publications in the order each was inserted, whatever has changed since" do
      {:ok, [first, second]} =
        Publication.insert_all([publication_attrs(), publication_attrs(%{year: 1954})])

      Repo.update_all(from(p in Publication, where: p.id == ^first.id), set: [year: first.year])

      assert Enum.map(Publication.all(), & &1.id) == [first.id, second.id]
    end
  end

  describe "insert_all/1" do
    import Publication, only: [insert_all: 1]

    test "when many valid publications are provided, inserts them" do
      assert [] == Publication.all()

      {:ok, publications} = insert_all(Enum.map(1953..1957, &publication_attrs(%{year: &1})))

      assert Publication.preload(publications) == Publication.all()
    end

    test "when invalid publications are provided, rolls back and returns the first error" do
      assert [] == Publication.all()
      attrs = publication_attrs()

      {:error, description} =
        insert_all([
          attrs,
          attrs,
          publication_attrs(%{year: 1955}),
          publication_attrs(%{year: 1956})
        ])

      assert {^attrs, :conflict} = description

      {:error, description} =
        insert_all([
          attrs,
          publication_attrs(%{year: 1955}),
          @skeleton_attrs,
          publication_attrs(%{year: 1956})
        ])

      assert {@skeleton_attrs, @skeleton_attrs_error_map} == description

      assert [] == Publication.all()
    end
  end

  describe "update/2" do
    test "updates the publication and returns {:ok, updated}" do
      publication = publication_fixture()

      result = Publication.update(publication.id, publication_attrs(%{title: "New Title"}))

      assert {:ok, updated} = result
      assert updated.id == publication.id
      assert updated.title == "New Title"
      assert [%Publication{title: "New Title"}] = Publication.all()
    end

    test "editing a keyed field changes identity without a collision" do
      publication = publication_fixture()

      result = Publication.update(publication.id, publication_attrs(%{year: 2000}))

      assert {:ok, updated} = result
      assert updated.id == publication.id
      assert updated.year == 2000
    end

    test "when the edit collides with another publication, returns {:error, :conflict}" do
      publication_fixture()
      other = publication_fixture(%{year: 1999})

      assert {:error, :conflict} == Publication.update(other.id, publication_attrs())
    end

    test "re-saving the same attributes does not conflict with itself" do
      publication = publication_fixture()

      assert {:ok, _} = Publication.update(publication.id, publication_attrs())
    end

    test "when the attributes are invalid, returns an error map" do
      publication = publication_fixture()

      result = Publication.update(publication.id, publication_attrs(%{title: ""}))
      assert {:error, %{title: :required}} = result
    end

    test "when the id does not exist, returns {:error, :not_found}" do
      assert {:error, :not_found} == Publication.update(999_999, publication_attrs())
    end

    test "replaces the linked countries, dropping the old join row but keeping the shared country" do
      publication = publication_fixture(%{countries: ["GB", "US"]})

      {:ok, updated} = Publication.update(publication.id, publication_attrs())

      # The publication now links only US, and the GB country row is kept: only
      # the join row was removed.
      assert ["US"] == Enum.map(updated.countries, & &1.code)
      assert ["GB", "US"] == Country |> Repo.all() |> Enum.map(& &1.code) |> Enum.sort()
    end

    test "recomputes the fingerprint when an association changes" do
      publication = publication_fixture()
      original_fingerprint = publication.countries_fingerprint

      {:ok, updated} = Publication.update(publication.id, publication_attrs(%{countries: ["GB"]}))

      assert ["GB"] == Enum.map(updated.countries, & &1.code)

      # The database rewrote the stored fingerprint for the new country.
      stored = Repo.get!(Publication, publication.id).countries_fingerprint
      %{rows: [[expected]]} = Repo.query!("SELECT rb_set_fingerprint($1)", [["GB"]])

      refute stored == original_fingerprint
      assert stored == expected
    end

    test "repoints the translated book when the original fields change, leaving the old one" do
      publication = publication_fixture()
      assert 1 == length(Repo.all(TranslatedBook))

      {:ok, updated} =
        Publication.update(
          publication.id,
          publication_attrs(%{original_title: "A different book"})
        )

      assert "A different book" == updated.translated_book.original_book.title
      # The previous translated book is kept.
      assert 2 == length(Repo.all(TranslatedBook))
    end

    test "adds sources, loaded in position order" do
      publication = publication_fixture()

      {:ok, _} =
        Publication.update(
          publication.id,
          Map.put(publication_attrs(), "sources", [
            %{"content" => "Second source", "position" => 1},
            %{"content" => "First source", "position" => 0}
          ])
        )

      # Read again, so the preload queries the sources and applies the
      # association's `preload_order`.
      reloaded = Repo.get(Publication, publication.id) |> Publication.preload()
      assert ["First source", "Second source"] == Enum.map(reloaded.sources, & &1.content)
    end

    test "loads many sources in position order" do
      publication = publication_fixture()

      # Several sources, given in descending position order, so the order the
      # preload returns is not the order they were given in.
      sources =
        0..5
        |> Enum.map(&%{"content" => "Source #{&1}", "position" => &1})
        |> Enum.reverse()

      {:ok, _} =
        Publication.update(publication.id, Map.put(publication_attrs(), "sources", sources))

      reloaded = Repo.get(Publication, publication.id) |> Publication.preload()

      assert Enum.map(0..5, &"Source #{&1}") == Enum.map(reloaded.sources, & &1.content)
      assert 6 == length(reloaded.sources)
    end

    test "keeps duplicate source content as distinct rows" do
      publication = publication_fixture()

      {:ok, updated} =
        Publication.update(
          publication.id,
          publication_attrs(%{sources: ["Same source", "Same source"]})
        )

      # Unlike countries, publishers and authors, which are shared rows stored
      # once, a publication owns its sources, so the same content is stored as
      # two rows.
      assert ["Same source", "Same source"] == Enum.map(updated.sources, & &1.content)
      assert 2 == length(Repo.all(Source))
    end

    test "replaces sources wholesale, deleting the previous rows" do
      publication =
        publication_fixture(%{sources: ["Old source 1", "Old source 2", "Old source 3"]})

      {:ok, updated} =
        Publication.update(publication.id, publication_attrs(%{sources: ["New source"]}))

      # Every previous row is deleted, leaving only the new one.
      assert ["New source"] == Enum.map(updated.sources, & &1.content)
      assert ["New source"] == Repo.all(Source) |> Enum.map(& &1.content)
    end

    test "clears sources when given an empty list" do
      publication = publication_fixture(%{sources: ["A source"]})

      {:ok, updated} = Publication.update(publication.id, publication_attrs(%{sources: []}))

      assert [] == updated.sources
      assert [] == Repo.all(Source)
    end

    test "leaves sources untouched when the payload omits them" do
      publication = publication_fixture(%{sources: ["A source"]})

      {:ok, updated} = Publication.update(publication.id, publication_attrs())

      assert ["A source"] == Enum.map(updated.sources, & &1.content)
    end
  end

  describe "duplicate entries in multi-value fields" do
    # The join tables' unique indexes would refuse these, so the changeset
    # refuses them first, with an error.
    test "a repeated country is rejected" do
      attrs = publication_attrs(%{countries: ["US", "US"]})

      assert {:error, %{countries: :duplicate}} = Publication.insert(attrs)
    end

    test "a repeated publisher is rejected" do
      attrs = publication_attrs(%{publishers: ["Noonday Press", "Noonday Press"]})

      assert {:error, %{publishers: :duplicate}} = Publication.insert(attrs)
    end

    test "a repeated translator is rejected" do
      attrs = publication_attrs(%{authors: ["Helen Caldwell", "Helen Caldwell"]})

      # Nested errors collapse to their innermost map, and the translators keep
      # their flat name.
      assert {:error, %{authors: :duplicate}} = Publication.insert(attrs)
    end

    test "a repeated original author is rejected" do
      attrs = publication_attrs(%{original_authors: ["Machado de Assis", "Machado de Assis"]})

      # The error is under `original_authors`, so it is not mistaken for a
      # repeated translator.
      assert {:error, %{original_authors: :duplicate}} = Publication.insert(attrs)
    end

    test "distinct entries in the same field are fine" do
      attrs = publication_attrs(%{countries: ["GB", "US"]})

      assert {:ok, publication} = Publication.insert(attrs)
      assert 2 == length(publication.countries)
    end

    test "an edit that introduces a duplicate is rejected" do
      publication = publication_fixture()
      attrs = publication_attrs(%{countries: ["US", "US"]})

      assert {:error, %{countries: :duplicate}} = Publication.update(publication.id, attrs)
    end
  end

  describe "saving a publication unchanged" do
    test "records no history entry and leaves the record alone" do
      publication = publication_fixture()

      assert {:ok, _} = Publication.update(publication.id, publication_attrs())
      assert {:ok, _} = Publication.update(publication.id, publication_attrs())

      # Only the creation: saving the same data again records nothing.
      assert ["created"] == Enum.map(History.of(publication.id), & &1.action)
    end

    test "a real edit after a no-op save is still recorded" do
      publication = publication_fixture()

      {:ok, _} = Publication.update(publication.id, publication_attrs())
      {:ok, _} = Publication.update(publication.id, publication_attrs(%{year: 1999}))

      # Newest first, as the log reads everywhere.
      assert ["updated", "created"] == Enum.map(History.of(publication.id), & &1.action)
    end

    test "a source-only edit is recorded, despite identical scalar fields" do
      publication = publication_fixture()

      {:ok, _} = Publication.update(publication.id, publication_attrs(%{sources: ["A source"]}))

      assert ["updated", "created"] == Enum.map(History.of(publication.id), & &1.action)
    end
  end

  describe "delete/2" do
    test "soft-deletes: the flat view hides the publication but the row survives" do
      publication = publication_fixture()
      assert [_] = Repo.all(FlatPublication)

      assert {:ok, %Publication{}} = Publication.delete(publication.id)

      assert [] == Repo.all(FlatPublication)
      assert %Publication{deleted_at: %DateTime{}} = Repo.get(Publication, publication.id)
    end

    test "keeps shared entities and owned sources" do
      publication = publication_fixture(%{sources: ["A source"]})

      countries = Repo.all(Country)
      translated_books = Repo.all(TranslatedBook)

      {:ok, _} = Publication.delete(publication.id)

      # Nothing is deleted with it: the shared rows and its own sources stay.
      assert countries == Repo.all(Country)
      assert translated_books == Repo.all(TranslatedBook)
      assert ["A source"] == Repo.all(Source) |> Enum.map(& &1.content)
    end

    test "frees the composite key: the same record can be imported again" do
      publication = publication_fixture()
      {:ok, _} = Publication.delete(publication.id)

      assert {:ok, reimported} = Publication.insert(publication_attrs())
      assert reimported.id != publication.id

      # One row in the index, and the tombstone still stored.
      assert [%{id: live_id}] = Repo.all(FlatPublication)
      assert live_id == reimported.id
      assert 2 == Repo.aggregate(Publication, :count)
    end

    test "returns :not_found for a missing or already-deleted publication" do
      publication = publication_fixture()
      {:ok, _} = Publication.delete(publication.id)

      assert {:error, :not_found} = Publication.delete(publication.id)
      assert {:error, :not_found} = Publication.delete(-1)
    end

    test "a deleted publication cannot be updated" do
      publication = publication_fixture()
      {:ok, _} = Publication.delete(publication.id)

      assert {:error, :not_found} = Publication.update(publication.id, publication_attrs())
    end
  end

  describe "restore/3" do
    test "brings a deleted publication back into the flat view" do
      publication = publication_fixture()
      {:ok, _} = Publication.delete(publication.id)
      assert [] == Repo.all(FlatPublication)

      assert {:ok, %Publication{}} = Publication.restore(publication.id)

      assert [%{id: id}] = Repo.all(FlatPublication)
      assert id == publication.id
      assert %Publication{deleted_at: nil} = Repo.get(Publication, publication.id)
    end

    test "returns :not_found for a live or missing publication" do
      publication = publication_fixture()

      assert {:error, :not_found} = Publication.restore(publication.id)
      assert {:error, :not_found} = Publication.restore(-1)
    end

    # Returns a deleted publication and the same publication imported again.
    defp deleted_with_twin do
      deleted = publication_fixture()
      {:ok, _} = Publication.delete(deleted.id)

      {deleted, publication_fixture()}
    end

    test "a conflict comes with the publication it conflicts with" do
      {deleted, twin} = deleted_with_twin()

      assert {:error, {:conflict, %Publication{id: id}}} = Publication.restore(deleted.id)
      assert id == twin.id
    end

    test "applies changes before restoring, and records them as an update" do
      {deleted, _twin} = deleted_with_twin()

      assert {:ok, _} =
               Publication.restore(
                 deleted.id,
                 History.system_actor(),
                 publication_attrs(%{year: 1954})
               )

      assert %Publication{deleted_at: nil, year: 1954} = Repo.get(Publication, deleted.id)

      assert ["restored", "updated", "deleted", "created"] ==
               Enum.map(History.of(deleted.id), & &1.action)
    end

    test "changes that still conflict write nothing" do
      {deleted, _twin} = deleted_with_twin()
      changes = publication_attrs(%{sources: ["A source"]})

      assert {:error, {:conflict, _twin}} =
               Publication.restore(deleted.id, History.system_actor(), changes)

      assert %Publication{deleted_at: deleted_at} = Repo.get(Publication, deleted.id)
      refute is_nil(deleted_at)
      assert ["deleted", "created"] == Enum.map(History.of(deleted.id), & &1.action)
    end

    test "changes that do not validate write nothing" do
      {deleted, _twin} = deleted_with_twin()

      assert {:error, %{year: _}} =
               Publication.restore(
                 deleted.id,
                 History.system_actor(),
                 publication_attrs(%{year: "not a year"})
               )

      assert %Publication{year: 1953} = Repo.get(Publication, deleted.id)
      assert ["deleted", "created"] == Enum.map(History.of(deleted.id), & &1.action)
    end

    test "undoing a delete that would now conflict is a plain conflict" do
      {deleted, _twin} = deleted_with_twin()
      [deletion | _] = History.of(deleted.id)

      assert {:error, :conflict} = Publication.undo(deleted.id, deletion.version)
    end
  end

  describe "merge/3" do
    # Two records of the same work, each holding something the other lacks.
    defp merge_pair do
      winner = publication_fixture(%{sources: ["A source"]})

      loser =
        publication_fixture(%{
          title: "Dom Casmurro: Another Printing",
          countries: ["GB"],
          publishers: ["Knopf"],
          sources: ["Another source"]
        })

      {winner, loser}
    end

    test "the winner may take on the key one of its losers held" do
      # The same publication twice, the loser naming one more publisher. Merged,
      # the winner names both, which is the loser's key. The key is checked once
      # the loser is tombstoned, so the merge goes through.
      winner = publication_fixture()
      loser = publication_fixture(%{publishers: ["Noonday Press", "Knopf"]})

      assert {:ok, merged} = Publication.merge(winner.id, [loser.id])
      assert length(merged.publishers) == 2
    end

    test "undoing a merge in which the winner took a loser's key gives each its own key back" do
      # The loser comes back holding the key the merged winner still holds, and
      # the winner's revert then gives it up. The key is checked once both are
      # written, so the undo goes through.
      winner = publication_fixture()
      loser = publication_fixture(%{publishers: ["Noonday Press", "Knopf"]})

      {:ok, _} = Publication.merge(winner.id, [loser.id])
      [merge | _] = History.of(winner.id)

      assert {:ok, _} = Publication.undo(winner.id, merge.version)

      assert %Publication{deleted_at: nil} = Repo.get(Publication, loser.id)

      assert ["Noonday Press"] ==
               Publication.find(winner.id).publishers |> Enum.map(& &1.name)

      assert ["Knopf", "Noonday Press"] ==
               Publication.find(loser.id).publishers |> Enum.map(& &1.name) |> Enum.sort()
    end

    test "the winner keeps what names it and gains what the loser held" do
      {winner, loser} = merge_pair()

      assert {:ok, merged} = Publication.merge(winner.id, [loser.id])

      assert merged.id == winner.id
      assert merged.title == winner.title

      assert ["GB", "US"] == merged.countries |> Enum.map(& &1.code) |> Enum.sort()

      assert ["Knopf", "Noonday Press"] ==
               merged.publishers |> Enum.map(& &1.name) |> Enum.sort()

      assert ["A source", "Another source"] ==
               merged.sources |> Enum.map(& &1.content) |> Enum.sort()
    end

    test "the winner keeps its comments, and the loser's are not added to them" do
      winner = publication_fixture(%{comments: "The winner's note."})

      loser =
        publication_fixture(%{
          title: "Dom Casmurro: Another Printing",
          comments: "The loser's note."
        })

      assert {:ok, merged} = Publication.merge(winner.id, [loser.id])
      assert merged.comments == "The winner's note."
    end

    test "a source both of them recorded is recorded once" do
      winner = publication_fixture(%{sources: ["A source"]})

      loser =
        publication_fixture(%{title: "Dom Casmurro: Another Printing", sources: ["A source"]})

      assert {:ok, merged} = Publication.merge(winner.id, [loser.id])

      assert ["A source"] == Enum.map(merged.sources, & &1.content)
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

      assert [entry | _] = History.of(winner.id)
      assert entry.action == "merged"
      assert entry.actor == "someone@example.com"
      assert History.other_ids(entry) == [loser.id]
    end

    test "a loser's own log gains nothing, and offers no undo while it is held" do
      {winner, loser} = merge_pair()
      before = History.of(loser.id)

      {:ok, _} = Publication.merge(winner.id, [loser.id])

      # The merge entry on the winner records what happened to the loser.
      assert Enum.map(History.of(loser.id), & &1.version) == Enum.map(before, & &1.version)

      # Nothing in its log can be undone while the winner holds it. Undoing the
      # merge is what gives it back.
      assert Enum.all?(History.all(), fn entry ->
               entry.publication_id != loser.id or not entry.undoable
             end)
    end

    test "a record a merge absorbed is not in the trash to be restored" do
      {winner, loser} = merge_pair()
      {:ok, _} = Publication.merge(winner.id, [loser.id])

      refute Enum.any?(Publication.all_deleted(), &(&1.id == loser.id))

      # A publication deleted after a merge is in the trash: the trash lists
      # what someone deleted, whatever happened to it before.
      {:ok, _} = Publication.delete(winner.id)
      assert Enum.any?(Publication.all_deleted(), &(&1.id == winner.id))
    end

    test "undoing a merge takes the whole thing back, under one entry" do
      {winner, loser} = merge_pair()

      countries_before =
        Publication.find(winner.id) |> Publication.Codec.flatten() |> Map.get(:countries)

      {:ok, _} = Publication.merge(winner.id, [loser.id])

      [merge | _] = History.of(winner.id)
      assert merge.undoable

      assert {:ok, _} = Publication.undo(winner.id, merge.version)

      # The loser is back, and not deleted.
      assert %Publication{deleted_at: nil} = Repo.get(Publication, loser.id)

      # The winner gave up what it had absorbed.
      assert Publication.find(winner.id) |> Publication.Codec.flatten() |> Map.get(:countries) ==
               countries_before

      # And the un-merge is one entry, naming what it gave back.
      assert [undone | _] = History.of(winner.id)
      assert undone.action == "unmerged"
      assert History.other_ids(undone) == [loser.id]
    end

    test "an un-merge is itself undoable, which merges them again" do
      {winner, loser} = merge_pair()
      {:ok, _} = Publication.merge(winner.id, [loser.id])
      [merge | _] = History.of(winner.id)
      {:ok, _} = Publication.undo(winner.id, merge.version)

      [undone | _] = History.of(winner.id)
      assert undone.undoable

      assert {:ok, _} = Publication.undo(winner.id, undone.version)

      assert %Publication{deleted_at: %DateTime{}} = Repo.get(Publication, loser.id)
      assert [again | _] = History.of(winner.id)
      assert again.action == "merged"
    end

    test "a record held inside another one has nothing of its own to undo" do
      {winner, loser} = merge_pair()
      {:ok, _} = Publication.merge(winner.id, [loser.id])

      # The merge entry is in the winner's stream, and the loser's own stream
      # still says it is held.
      [entry | _] = History.of(loser.id)
      refute entry.undoable
      assert {:error, :conflict} = Publication.undo(loser.id, entry.version)
    end

    test "a record inside another one is not restored on its own" do
      {winner, loser} = merge_pair()
      {:ok, _} = Publication.merge(winner.id, [loser.id])

      # Restoring it would store the duplicate again while the winner keeps
      # what it took, so only undoing the merge brings it back.
      assert {:error, :absorbed} = Publication.restore(loser.id)
      assert %Publication{deleted_at: %DateTime{}} = Repo.get(Publication, loser.id)
      refute Enum.any?(History.of(loser.id), &(&1.action == "restored"))
    end

    test "a record given back by an un-merge is out of hiding, and in the index" do
      {winner, loser} = merge_pair()
      {:ok, _} = Publication.merge(winner.id, [loser.id])
      [merge | _] = History.of(winner.id)
      {:ok, _} = Publication.undo(winner.id, merge.version)

      # It is not in the trash, because nobody deleted it, and it is in the
      # index again.
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

      assert {:error, :no_losers} = Publication.merge(winner.id, [])
    end

    test "surfaces a collision with a third publication rather than crashing" do
      {winner, loser} = merge_pair()

      # A third record already holds what the merged one would: the same title
      # and year, and the countries and publishers the merge would union.
      third =
        publication_fixture(%{
          countries: ["GB", "US"],
          publishers: ["Knopf", "Noonday Press"]
        })

      assert {:error, :conflict} = Publication.merge(winner.id, [loser.id])

      # Nothing moved: the loser is still here and the third is untouched.
      assert is_nil(Repo.get(Publication, loser.id).deleted_at)
      assert %Publication{} = Repo.get(Publication, third.id)
    end

    test "merges several losers at once, and gives them all back on undo" do
      {winner, loser} = merge_pair()
      another = publication_fixture(%{title: "Dom Casmurro: A Third Printing", year: 1953})

      assert {:ok, merged} = Publication.merge(winner.id, [loser.id, another.id])
      assert [%{id: live}] = Repo.all(FlatPublication)
      assert live == merged.id

      [merge | _] = History.of(winner.id)
      assert Enum.sort(History.other_ids(merge)) == Enum.sort([loser.id, another.id])

      assert {:ok, _} = Publication.undo(winner.id, merge.version)

      assert Enum.sort(Enum.map(Repo.all(FlatPublication), & &1.id)) ==
               Enum.sort([winner.id, loser.id, another.id])
    end
  end
end
