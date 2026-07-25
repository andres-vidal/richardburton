defmodule RichardBurton.Publication.HistoryTest do
  @moduledoc """
  Tests for the append-only publication history log
  """

  use RichardBurton.DataCase

  alias RichardBurton.Publication
  alias RichardBurton.Publication.History

  doctest RichardBurton.Publication.History

  @attrs %{
    "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
    "countries" => [%{"code" => "GB"}],
    "year" => 1886,
    "publishers" => [%{"name" => "Bickers & Son"}],
    "translated_book" => %{
      "authors" => [%{"name" => "Richard Burton"}],
      "original_book" => %{
        "authors" => [%{"name" => "J. M. Pereira da Silva"}],
        "title" => "Manuel de Moraes: crônica do século XVII"
      }
    }
  }

  describe "snapshot/1" do
    # The equality contract `update/3` relies on to decide whether a save is
    # worth logging.
    setup do
      {:ok, publication} = Publication.insert(@attrs)
      [publication: publication]
    end

    test "is equal for the same state", %{publication: publication} do
      assert History.snapshot(publication) == History.snapshot(publication)
    end

    test "differs once a field changes", %{publication: publication} do
      retitled = %{publication | title: "Manuel de Moraes"}
      refute History.snapshot(publication) == History.snapshot(retitled)
    end

    test "differs once references change", %{publication: publication} do
      {:ok, sourced} =
        Publication.update(
          publication.id,
          Map.put(@attrs, "references", [%{"content" => "A source", "position" => 0}])
        )

      # The case a changeset cannot detect: references are replaced wholesale,
      # so only the resulting state tells you whether anything moved.
      refute History.snapshot(publication) == History.snapshot(sourced)
    end

    test "ignores when the record was touched, only what it says", %{
      publication: publication
    } do
      # updated_at is not part of the flattened state, so re-saving identical
      # data cannot look like a change.
      touched = %{publication | updated_at: ~N[2030-01-01 00:00:00]}

      assert History.snapshot(publication) == History.snapshot(touched)
    end
  end

  test "every mutation appends to an ordered, versioned stream" do
    {:ok, publication} = Publication.insert(@attrs, "admin@example.com")

    {:ok, _} =
      Publication.update(
        publication.id,
        Map.put(@attrs, "title", "Manuel de Moraes"),
        "admin@example.com"
      )

    {:ok, _} = Publication.delete(publication.id, "admin@example.com")
    {:ok, _} = Publication.restore(publication.id, "admin@example.com")

    stream = History.of(publication.id)

    assert [4, 3, 2, 1] == Enum.map(stream, & &1.version)
    assert ["restored", "deleted", "updated", "created"] == Enum.map(stream, & &1.action)
    assert Enum.all?(stream, &(&1.actor == "admin@example.com"))

    # Snapshots are diffable: each carries the record's state after the action.
    [_restored, _deleted, updated, created] = stream
    assert created.snapshot["title"] =~ "Chronicle"
    assert updated.snapshot["title"] == "Manuel de Moraes"
  end

  describe "diffs" do
    setup do
      {:ok, publication} = Publication.insert(@attrs, "admin@example.com")
      [publication: publication]
    end

    defp edit(publication, attrs) do
      {:ok, updated} = Publication.update(publication.id, Map.merge(@attrs, attrs), "a@b.com")
      updated
    end

    test "an update names the fields that moved, with raw before/after values", %{
      publication: publication
    } do
      edit(publication, %{"title" => "Manuel de Moraes", "year" => 1887})

      expected_diff = %{
        "title" => %{
          from: "Manuel de Moraes: A Chronicle of the Seventeenth Century",
          to: "Manuel de Moraes"
        },
        "year" => %{from: 1886, to: 1887}
      }

      assert [%History{diff: diff} | _] = History.of(publication.id)
      assert expected_diff == diff.fields

      # Only what moved: untouched fields are absent, not present-and-equal.
      refute Map.has_key?(diff.fields, "publishers")
      assert diff.references == nil
    end

    # References are positional, so a fixture has to say where each one sits —
    # which is also what makes a pure reorder expressible.
    defp references(contents) do
      contents
      |> Enum.with_index()
      |> Enum.map(fn {content, position} ->
        %{"content" => content, "position" => position}
      end)
    end

    test "references diff as the exact entries added and removed", %{publication: publication} do
      edit(publication, %{"references" => references(["Pontiero, Giovanni."])})
      edit(publication, %{"references" => references(["Moser, Benjamin."])})

      expected_diff = %{
        added: ["Moser, Benjamin."],
        removed: ["Pontiero, Giovanni."],
        reordered: false
      }

      assert [%History{diff: diff} | _] = History.of(publication.id)

      assert expected_diff == diff.references
    end

    test "the same references in a new order is a reorder", %{publication: publication} do
      edit(publication, %{"references" => references(["Alpha", "Beta"])})
      edit(publication, %{"references" => references(["Beta", "Alpha"])})

      assert [%History{diff: diff} | _] = History.of(publication.id)
      assert diff.references == %{added: [], removed: [], reordered: true}
    end

    test "only updates carry a diff", %{publication: publication} do
      edit(publication, %{"title" => "Manuel de Moraes"})
      {:ok, _} = Publication.delete(publication.id, "a@b.com")
      {:ok, _} = Publication.restore(publication.id, "a@b.com")

      expected_diffs = [
        {"restored", false},
        {"deleted", false},
        {"updated", true},
        {"created", false}
      ]

      diffs = History.of(publication.id) |> Enum.map(&{&1.action, &1.diff != nil})

      # The import has no predecessor to diff against; delete and restore change
      # no field an editor entered.
      assert expected_diffs == diffs
    end

    test "the feed diffs each entry against its own record, not the row above", %{
      publication: publication
    } do
      {:ok, other} =
        @attrs |> Map.put("title", "Iraçéma the Honey-Lips") |> Publication.insert("a@b.com")

      # Interleave the two records' updates so array neighbours belong to
      # different publications.
      edit(publication, %{"title" => "Manuel de Moraes"})

      {:ok, _} =
        Publication.update(
          other.id,
          @attrs |> Map.put("title", "Iracema"),
          "a@b.com"
        )

      updates = History.all() |> Enum.filter(&(&1.action == "updated"))

      assert length(updates) == 2

      for entry <- updates do
        assert map_size(entry.diff.fields) == 1
        assert Map.has_key?(entry.diff.fields, "title")
      end
    end
  end

  describe "undo" do
    setup do
      {:ok, publication} = Publication.insert(@attrs, "admin@example.com")
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

    test "an update is undone by putting its fields back", %{publication: publication} do
      original = publication.title
      retitled = Map.put(@attrs, "title", "Retitled")

      {:ok, _} = Publication.update(publication.id, retitled, "a@b.com")

      version = version_of(publication, "updated")

      assert {:ok, reverted} = Publication.undo(publication.id, version, "a@b.com")

      assert reverted.title == original
      # The undo is itself an event, not an erasure: the log only ever grows.
      assert ["updated", "updated", "created"] = actions(publication)
    end

    test "undoing an older update keeps the later edit to another field", %{
      publication: publication
    } do
      retitled = Map.put(@attrs, "title", "Retitled")

      {:ok, _} = Publication.update(publication.id, retitled, "a@b.com")

      version = version_of(publication, "updated")

      {:ok, _} = Publication.update(publication.id, Map.put(retitled, "year", 1999), "a@b.com")

      assert {:ok, reverted} = Publication.undo(publication.id, version, "a@b.com")

      # Exactly the retitle is undone; the year edit that followed survives.
      assert reverted.title =~ "Chronicle"
      assert reverted.year == 1999
    end

    test "an older update whose field was touched since is refused", %{publication: publication} do
      {:ok, _} = Publication.update(publication.id, Map.put(@attrs, "title", "First"), "a@b.com")
      first = version_of(publication, "updated")
      {:ok, _} = Publication.update(publication.id, Map.put(@attrs, "title", "Second"), "a@b.com")

      # Undoing it would silently discard the second retitle.
      assert {:error, :conflict} = Publication.undo(publication.id, first, "a@b.com")
    end

    test "the rule is enforced here, not merely rendered", %{publication: publication} do
      retitled = Map.put(@attrs, "title", "Retitled")

      {:ok, _} = Publication.update(publication.id, retitled, "a@b.com")
      {:ok, _} = Publication.delete(publication.id, "a@b.com")

      # The record is deleted, so the update is no longer reconcilable — a client
      # that asked anyway is refused rather than obeyed.
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
        Publication.update(publication.id, Map.put(@attrs, "title", "Retitled"), "a@b.com")

      version = version_of(publication, "updated")

      assert {:ok, _} = Publication.undo(publication.id, version, "a@b.com")
      assert {:error, :conflict} = Publication.undo(publication.id, version, "a@b.com")
    end
  end

  test "mutations outside a request are attributed to the system actor" do
    {:ok, publication} = Publication.insert(@attrs)

    assert [%History{actor: "system", action: "created"}] = History.of(publication.id)
  end

  test "a bulk insert records one created row per publication" do
    second = Map.put(@attrs, "title", "Iraçéma the Honey-Lips")

    {:ok, publications} = Publication.insert_all([@attrs, second], "admin@example.com")

    for publication <- publications do
      assert [%History{version: 1, action: "created", actor: "admin@example.com"}] =
               History.of(publication.id)
    end
  end

  test "the log rejects UPDATE at the database level" do
    {:ok, publication} = Publication.insert(@attrs)

    assert_raise Postgrex.Error, ~r/append-only/, fn ->
      Repo.update_all(History, set: [actor: "tampered"])
    end

    # The guard fired before any row changed.
    assert [%History{actor: "system"}] = History.of(publication.id)
  end

  test "the log rejects DELETE at the database level" do
    {:ok, publication} = Publication.insert(@attrs)

    assert_raise Postgrex.Error, ~r/append-only/, fn ->
      Repo.delete_all(History)
    end

    assert [%History{}] = History.of(publication.id)
  end
end
