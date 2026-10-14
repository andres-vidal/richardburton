defmodule RichardBurton.Publication.HistoryTest do
  @moduledoc """
  Tests for the append-only publication history log
  """

  use RichardBurton.DataCase

  alias RichardBurton.Publication
  alias RichardBurton.Publication.History
  alias RichardBurton.Publisher

  doctest RichardBurton.Publication.History

  describe "snapshot/1" do
    # The equality `Publication.update/3` relies on to decide whether a save
    # changed anything.
    setup do
      [publication: publication_fixture()]
    end

    test "is equal for the same state", %{publication: publication} do
      assert History.snapshot(publication) == History.snapshot(publication)
    end

    test "differs once a field changes", %{publication: publication} do
      retitled = %{publication | title: "Dom Casmurro: A Novel"}
      refute History.snapshot(publication) == History.snapshot(retitled)
    end

    test "differs once sources change", %{publication: publication} do
      {:ok, sourced} =
        Publication.update(publication.id, publication_attrs(%{sources: ["A source"]}))

      # A changeset cannot tell this change: it replaces the sources on every
      # save, so only the resulting state shows whether they changed.
      refute History.snapshot(publication) == History.snapshot(sourced)
    end

    test "lists each set of names sorted", %{publication: publication} do
      reordered = %{
        publication
        | publishers: [%Publisher{name: "Noonday Press"}, %Publisher{name: "Knopf"}]
      }

      assert History.snapshot(reordered).publishers == ["Knopf", "Noonday Press"]
    end

    test "ignores when the record was touched, only what it says", %{
      publication: publication
    } do
      # `updated_at` is not part of the snapshot, so saving the same data again
      # does not look like a change.
      touched = %{publication | updated_at: ~N[2030-01-01 00:00:00]}

      assert History.snapshot(publication) == History.snapshot(touched)
    end
  end

  test "every mutation appends to an ordered, versioned stream" do
    {:ok, publication} = Publication.insert(publication_attrs(), "admin@example.com")

    {:ok, _} =
      Publication.update(
        publication.id,
        publication_attrs(%{title: "Dom Casmurro: A Novel"}),
        "admin@example.com"
      )

    {:ok, _} = Publication.delete(publication.id, "admin@example.com")
    {:ok, _} = Publication.restore(publication.id, "admin@example.com")

    stream = History.of(publication.id)

    assert [4, 3, 2, 1] == Enum.map(stream, & &1.version)
    assert ["restored", "deleted", "updated", "created"] == Enum.map(stream, & &1.action)
    assert Enum.all?(stream, &(&1.actor == "admin@example.com"))

    # Each snapshot holds the record's state after the action.
    [_restored, _deleted, updated, created] = stream
    assert created.snapshot["title"] == "Dom Casmurro"
    assert updated.snapshot["title"] == "Dom Casmurro: A Novel"
  end

  describe "diffs" do
    setup do
      {:ok, publication} = Publication.insert(publication_attrs(), "admin@example.com")
      [publication: publication]
    end

    # Updates the publication to `publication_attrs/1` for `changes`.
    defp edit(publication, changes) do
      {:ok, updated} = Publication.update(publication.id, publication_attrs(changes), "a@b.com")
      updated
    end

    test "an update names the fields that moved, with raw before/after values", %{
      publication: publication
    } do
      edit(publication, %{title: "Dom Casmurro: A Novel", year: 1954})

      expected_diff = %{
        "title" => %{from: "Dom Casmurro", to: "Dom Casmurro: A Novel"},
        "year" => %{from: 1953, to: 1954}
      }

      assert [%History{diff: diff} | _] = History.of(publication.id)
      assert expected_diff == diff.fields

      # Only what moved: untouched fields are absent, not present-and-equal.
      refute Map.has_key?(diff.fields, "publishers")
      assert diff.sources == nil
    end

    # A stored snapshot can list a set of names in any order. The diff compares
    # each set by its members.
    test "an entry that lists a set of names in another order shows no change to it" do
      publication = publication_fixture(%{publishers: ["Knopf", "Noonday Press"]})
      [created] = History.of(publication.id)

      snapshot =
        created.snapshot
        |> Map.update!("publishers", &Enum.reverse/1)
        |> Map.put("title", "Dom Casmurro: A Novel")

      %History{}
      |> History.changeset(%{
        publication_id: publication.id,
        version: 2,
        action: "updated",
        snapshot: snapshot,
        actor: "a@b.com"
      })
      |> Repo.insert!()

      assert [%History{diff: diff} | _] = History.of(publication.id)
      assert Map.keys(diff.fields) == ["title"]
    end

    test "a change to the comments is diffed like any other field", %{publication: publication} do
      edit(publication, %{comments: "Bound in **green** cloth."})

      assert [%History{diff: diff} | _] = History.of(publication.id)
      assert diff.fields == %{"comments" => %{from: nil, to: "Bound in **green** cloth."}}
    end

    test "a snapshot without a comments key holds the same comments as one whose comments are nil",
         %{publication: publication} do
      [created] = History.of(publication.id)

      snapshot =
        created.snapshot
        |> Map.delete("comments")
        |> Map.put("title", "Dom Casmurro: A Novel")

      %History{}
      |> History.changeset(%{
        publication_id: publication.id,
        version: 2,
        action: "updated",
        snapshot: snapshot,
        actor: "a@b.com"
      })
      |> Repo.insert!()

      assert [%History{diff: diff} | _] = History.of(publication.id)
      assert Map.keys(diff.fields) == ["title"]
    end

    test "sources diff as the exact entries added and removed", %{publication: publication} do
      edit(publication, %{sources: ["Pontiero, Giovanni."]})
      edit(publication, %{sources: ["Moser, Benjamin."]})

      expected_diff = %{
        added: ["Moser, Benjamin."],
        removed: ["Pontiero, Giovanni."],
        reordered: false
      }

      assert [%History{diff: diff} | _] = History.of(publication.id)

      assert expected_diff == diff.sources
    end

    test "the same sources in a new order is a reorder", %{publication: publication} do
      edit(publication, %{sources: ["Alpha", "Beta"]})
      edit(publication, %{sources: ["Beta", "Alpha"]})

      assert [%History{diff: diff} | _] = History.of(publication.id)
      assert diff.sources == %{added: [], removed: [], reordered: true}
    end

    test "only updates carry a diff", %{publication: publication} do
      edit(publication, %{title: "Dom Casmurro: A Novel"})
      {:ok, _} = Publication.delete(publication.id, "a@b.com")
      {:ok, _} = Publication.restore(publication.id, "a@b.com")

      expected_diffs = [
        {"restored", false},
        {"deleted", false},
        {"updated", true},
        {"created", false}
      ]

      diffs = History.of(publication.id) |> Enum.map(&{&1.action, &1.diff != nil})

      # The import has no entry before it to compare with, and a delete and a
      # restore change no field.
      assert expected_diffs == diffs
    end

    test "the feed diffs each entry against its own record, not the row above", %{
      publication: publication
    } do
      {:ok, other} =
        Publication.insert(publication_attrs(%{title: "Iraçéma the Honey-Lips"}), "a@b.com")

      # The two records' updates interleave, so neighbouring entries belong to
      # different publications.
      edit(publication, %{title: "Dom Casmurro: A Novel"})
      {:ok, _} = Publication.update(other.id, publication_attrs(%{title: "Iracema"}), "a@b.com")

      updates = History.all() |> Enum.filter(&(&1.action == "updated"))

      assert length(updates) == 2

      for entry <- updates do
        assert map_size(entry.diff.fields) == 1
        assert Map.has_key?(entry.diff.fields, "title")
      end
    end
  end

  describe "all/0" do
    test "annotates each entry as the publication's own stream does" do
      winner = publication_fixture()
      loser = publication_fixture(%{title: "Dom Casmurro: Another Printing"})
      other = publication_fixture(%{year: 1954})

      {:ok, _} = Publication.merge(winner.id, [loser.id])
      {:ok, _} = Publication.update(other.id, publication_attrs(%{year: 1955}))

      streams = Enum.flat_map([winner, loser, other], &History.of(&1.id))

      assert Enum.sort_by(History.all(), & &1.id) == Enum.sort_by(streams, & &1.id)
    end

    test "reads the whole log with one query" do
      winner = publication_fixture()
      loser = publication_fixture(%{title: "Dom Casmurro: Another Printing"})
      {:ok, _} = Publication.merge(winner.id, [loser.id])

      assert {_entries, 1} = count_queries(&History.all/0)
    end
  end

  describe "absorbed/1" do
    test "holds the ids a merge absorbed until the merge is undone" do
      winner = publication_fixture()
      loser = publication_fixture(%{title: "Dom Casmurro: Another Printing"})
      ids = [winner.id, loser.id]

      assert History.absorbed(ids) == MapSet.new()

      {:ok, _} = Publication.merge(winner.id, [loser.id])
      assert History.absorbed(ids) == MapSet.new([loser.id])

      [merge | _] = History.of(winner.id)
      {:ok, _} = Publication.undo(winner.id, merge.version)
      assert History.absorbed(ids) == MapSet.new()

      [unmerge | _] = History.of(winner.id)
      {:ok, _} = Publication.undo(winner.id, unmerge.version)
      assert History.absorbed(ids) == MapSet.new([loser.id])
    end

    test "answers only for the ids it is given" do
      winner = publication_fixture()
      loser = publication_fixture(%{title: "Dom Casmurro: Another Printing"})
      {:ok, _} = Publication.merge(winner.id, [loser.id])

      assert History.absorbed([winner.id]) == MapSet.new()
      assert History.absorbed([]) == MapSet.new()
    end
  end

  describe "undo" do
    setup do
      {:ok, publication} = Publication.insert(publication_attrs(), "admin@example.com")
      [publication: publication]
    end

    defp actions(publication), do: History.of(publication.id) |> Enum.map(& &1.action)

    defp version_of(publication, action) do
      History.of(publication.id) |> Enum.find(&(&1.action == action)) |> Map.fetch!(:version)
    end

    test "an import is undone by deleting the record", %{publication: publication} do
      assert {:ok, _} = Publication.undo(publication.id, 1, "a@b.com")

      assert ["deleted", "created"] = actions(publication)
      # Soft-deleted, so it sits in the trash exactly as a delete would leave it.
      assert Enum.any?(Publication.all_deleted(), &(&1.id == publication.id))
    end

    test "a delete is undone by restoring it", %{publication: publication} do
      {:ok, _} = Publication.delete(publication.id, "a@b.com")

      assert {:ok, _} =
               Publication.undo(publication.id, version_of(publication, "deleted"), "a@b.com")

      assert ["restored", "deleted", "created"] = actions(publication)
      refute Enum.any?(Publication.all_deleted(), &(&1.id == publication.id))
    end

    test "undoing an update that added comments takes them away", %{publication: publication} do
      {:ok, _} =
        Publication.update(publication.id, publication_attrs(%{comments: "A note."}), "a@b.com")

      version = version_of(publication, "updated")

      assert {:ok, reverted} = Publication.undo(publication.id, version, "a@b.com")
      assert reverted.comments == nil
    end

    test "an update is undone by putting its fields back", %{publication: publication} do
      original = publication.title

      {:ok, _} =
        Publication.update(publication.id, publication_attrs(%{title: "Retitled"}), "a@b.com")

      version = version_of(publication, "updated")

      assert {:ok, reverted} = Publication.undo(publication.id, version, "a@b.com")

      assert reverted.title == original
      # The undo is itself an entry, and the log only grows.
      assert ["updated", "updated", "created"] = actions(publication)
    end

    test "undoing an older update keeps the later edit to another field", %{
      publication: publication
    } do
      {:ok, _} =
        Publication.update(publication.id, publication_attrs(%{title: "Retitled"}), "a@b.com")

      version = version_of(publication, "updated")

      {:ok, _} =
        Publication.update(
          publication.id,
          publication_attrs(%{title: "Retitled", year: 1999}),
          "a@b.com"
        )

      assert {:ok, reverted} = Publication.undo(publication.id, version, "a@b.com")

      # Only the retitle is undone, and the later change of year is kept.
      assert reverted.title == "Dom Casmurro"
      assert reverted.year == 1999
    end

    test "an older update whose field was touched since is refused", %{publication: publication} do
      {:ok, _} =
        Publication.update(publication.id, publication_attrs(%{title: "First"}), "a@b.com")

      first = version_of(publication, "updated")

      {:ok, _} =
        Publication.update(publication.id, publication_attrs(%{title: "Second"}), "a@b.com")

      # Undoing it would discard the second retitle.
      assert {:error, :conflict} = Publication.undo(publication.id, first, "a@b.com")
    end

    test "an update of a deleted publication is not undoable, and undoing it is refused", %{
      publication: publication
    } do
      {:ok, _} =
        Publication.update(publication.id, publication_attrs(%{title: "Retitled"}), "a@b.com")

      {:ok, _} = Publication.delete(publication.id, "a@b.com")

      refute History.of(publication.id)
             |> Enum.find(&(&1.action == "updated"))
             |> Map.fetch!(:undoable)

      result = Publication.undo(publication.id, version_of(publication, "updated"), "a@b.com")
      assert {:error, :conflict} = result
    end

    test "an unknown version is a miss", %{publication: publication} do
      assert {:error, :not_found} = Publication.undo(publication.id, 99, "a@b.com")
    end

    test "undoing twice is refused the second time", %{publication: publication} do
      {:ok, _} =
        Publication.update(publication.id, publication_attrs(%{title: "Retitled"}), "a@b.com")

      version = version_of(publication, "updated")

      assert {:ok, _} = Publication.undo(publication.id, version, "a@b.com")
      assert {:error, :conflict} = Publication.undo(publication.id, version, "a@b.com")
    end
  end

  test "mutations outside a request are attributed to the system actor" do
    publication = publication_fixture()

    assert [%History{actor: "system", action: "created"}] = History.of(publication.id)
  end

  test "a bulk insert records one created row per publication" do
    {:ok, publications} =
      Publication.insert_all(
        [publication_attrs(), publication_attrs(%{title: "Iraçéma the Honey-Lips"})],
        "admin@example.com"
      )

    for publication <- publications do
      assert [%History{version: 1, action: "created", actor: "admin@example.com"}] =
               History.of(publication.id)
    end
  end

  test "the log rejects UPDATE at the database level" do
    publication = publication_fixture()

    assert_raise Postgrex.Error, ~r/append-only/, fn ->
      Repo.update_all(History, set: [actor: "tampered"])
    end

    # The guard fired before any row changed.
    assert [%History{actor: "system"}] = History.of(publication.id)
  end

  test "the log rejects DELETE at the database level" do
    publication = publication_fixture()

    assert_raise Postgrex.Error, ~r/append-only/, fn ->
      Repo.delete_all(History)
    end

    assert [%History{}] = History.of(publication.id)
  end
end
