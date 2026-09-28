defmodule RichardBurton.DocumentTest do
  @moduledoc """
  Tests for import documents: the shared list of them, the updates each one's
  content is made of, and what taking one off the list means.
  """
  use RichardBurton.DataCase

  alias RichardBurton.Document
  alias RichardBurton.Repo

  defp document(name \\ "Second pass"), do: document_fixture(name)

  # Just the bytes, for the cases where the point is what a reader would apply
  # rather than how far the read reaches.
  defp applied(document, opts \\ []) do
    {updates, _through} = Document.updates(document, opts)
    updates
  end

  # The ids on a page of the list, in the order it holds them.
  defp listed(opts \\ []),
    do: opts |> Document.page() |> Map.fetch!(:entries) |> Enum.map(& &1.id)

  # Moves a document's last change to a given moment, so the order of the list
  # does not rest on which of two was written first. The moment is padded to the
  # microsecond, which is how the list holds it.
  defp changed_at(document, moment) do
    moment = NaiveDateTime.add(moment, 0, :microsecond)

    {:ok, document} =
      document |> Ecto.Changeset.change(updated_at: moment) |> Repo.update()

    document
  end

  describe "create/1" do
    test "starts one under a name" do
      {:ok, document} = Document.create(%{"name" => "Second pass"})

      assert document.name == "Second pass"
      assert document.rows == 0
    end

    test "a document needs a name, since the name is what tells it from another" do
      assert {:error, changeset} = Document.create(%{"name" => ""})
      refute changeset.valid?
    end
  end

  describe "page/1" do
    test "lists every document, whoever started it" do
      # The list is shared: there is no owner to scope it to.
      one = document("Mine")
      another = document("Somebody else's")

      assert Enum.sort(listed()) == Enum.sort([one.id, another.id])
    end

    test "most recently changed first" do
      newer = document("Newer")
      # Aged deliberately: both were started in the same second, and the point
      # is which was last *changed*, not which was started.
      older = document("Older") |> changed_at(~N[2020-01-01 00:00:00])

      assert listed() == [newer.id, older.id]
    end

    test "a page of them, so a long-kept workspace does not read its whole table" do
      for name <- ["One", "Two", "Three"], do: document(name)

      assert %{entries: entries, more: true} = Document.page(limit: 2)
      assert length(entries) == 2
    end

    test "a page that reaches the end says nothing more follows, even when it is full" do
      for name <- ["One", "Two"], do: document(name)

      assert %{entries: [_, _], more: false} = Document.page(limit: 2)
    end

    test "the next page starts after the cursor of the one before" do
      first = document("First") |> changed_at(~N[2026-09-03 00:00:00])
      second = document("Second") |> changed_at(~N[2026-09-02 00:00:00])
      third = document("Third") |> changed_at(~N[2026-09-01 00:00:00])

      assert listed(limit: 2) == [first.id, second.id]

      assert %{entries: [next], more: false} =
               Document.page(limit: 2, after: {second.updated_at, second.id})

      assert next.id == third.id
    end

    # A change and a start a moment apart are not a tie, as they would be if the
    # list were held to the second: the tie would go to whichever was started
    # later.
    test "a change lists a document above one started a moment before it" do
      older = document("Older")
      newer = document("Newer")

      {:ok, _} = Document.append(older, <<1>>, 1)

      assert listed() == [older.id, newer.id]
    end

    test "two changed at the same instant are told apart by id, so the cursor still holds" do
      moment = ~N[2026-09-01 00:00:00]
      earlier = document("Earlier") |> changed_at(moment)
      later = document("Later") |> changed_at(moment)

      assert listed(limit: 1) == [later.id]
      assert listed(limit: 1, after: {moment, later.id}) == [earlier.id]
    end

    # What reading from a position rather than skipping a count is for: a
    # document changed between two reads moves to the top of the list, and every
    # count below it shifts by one.
    test "a document changed between reads is not read twice" do
      first = document("First") |> changed_at(~N[2026-09-03 00:00:00])
      second = document("Second") |> changed_at(~N[2026-09-02 00:00:00])
      third = document("Third") |> changed_at(~N[2026-09-01 00:00:00])

      assert listed(limit: 2) == [first.id, second.id]

      # Somebody writes to the last one on the page already read.
      {:ok, _} = Document.append(second, <<1>>, 1)

      assert listed(limit: 2, after: {second.updated_at, second.id}) == [third.id]
    end

    test "an asking-for-everything limit is bounded rather than honoured" do
      document()

      assert length(listed(limit: 10_000)) == 1
    end

    test "archived documents are not on it" do
      kept = document("Kept")
      {:ok, _} = document("Retired") |> Document.archive()

      assert listed() == [kept.id]
    end

    test "archived ones are, when those are asked for" do
      document("Kept")
      {:ok, retired} = document("Retired") |> Document.archive()

      assert listed(archived: true) == [retired.id]
    end
  end

  describe "archive/1 and unarchive/1" do
    test "archiving takes it off the list without destroying what it holds" do
      document = document()
      {:ok, _} = Document.append(document, <<1, 2, 3>>, 1)

      {:ok, archived} = Document.archive(document)

      assert archived.archived_at
      assert applied(archived) == [<<1, 2, 3>>]
    end

    test "an archived document is still reachable by id, so an open link does not break" do
      {:ok, archived} = document() |> Document.archive()

      assert {:ok, found} = Document.find(archived.id)
      assert found.id == archived.id
    end

    test "it can be put back" do
      {:ok, archived} = document() |> Document.archive()
      {:ok, restored} = Document.unarchive(archived)

      refute restored.archived_at
      assert listed() == [restored.id]
    end
  end

  describe "rename/2" do
    test "gives it a different name" do
      {:ok, renamed} = document("Before") |> Document.rename("After")

      assert renamed.name == "After"
    end

    test "a name it could not be told apart by is refused" do
      assert {:error, changeset} = document() |> Document.rename("")
      refute changeset.valid?
    end
  end

  describe "updates/1 and append/3" do
    test "hands back what was appended, in the order it was written" do
      document = document()

      {:ok, _} = Document.append(document, <<1, 2, 3>>, 1)
      {:ok, _} = Document.append(document, <<4, 5>>, 2)

      assert applied(document) == [<<1, 2, 3>>, <<4, 5>>]
    end

    test "says how far the read reaches, which is what a compaction names" do
      document = document()

      {:ok, _} = Document.append(document, <<1>>, 1)
      {:ok, _} = Document.append(document, <<2>>, 2)

      {_updates, through} = Document.updates(document)

      assert through == Repo.one(from(u in Document.Update, select: max(u.id)))
    end

    test "each document's updates are its own" do
      one = document("One")
      another = document("Another")

      {:ok, _} = Document.append(one, <<1>>, 1)
      {:ok, _} = Document.append(another, <<2>>, 1)

      assert applied(one) == [<<1>>]
      assert applied(another) == [<<2>>]
    end

    test "the row count is the client's word, recorded as given" do
      document = document()

      {:ok, _} = Document.append(document, <<1>>, 428)

      assert Repo.get(Document, document.id).rows == 428
    end

    # What the boundary hands over when the request carried no usable count.
    # Reading one out of a request is the controller's job, not this one's.
    test "no count leaves the count alone rather than refusing the change" do
      document = document()
      {:ok, _} = Document.append(document, <<1>>, 7)

      {:ok, _} = Document.append(document, <<2>>, nil)

      assert Repo.get(Document, document.id).rows == 7
      assert applied(document) == [<<1>>, <<2>>]
    end

    test "a document nobody has written to has nothing to apply" do
      assert applied(document()) == []
    end

    test "a reader that has read through a point is handed only what came after it" do
      document = document()

      {:ok, _} = Document.append(document, <<1>>, 1)
      {_updates, through} = Document.updates(document)
      {:ok, _} = Document.append(document, <<2>>, 2)

      assert applied(document, after: through) == [<<2>>]
    end

    test "with nothing written since, the point read through stays where it was" do
      document = document()

      {:ok, _} = Document.append(document, <<1>>, 1)
      {_updates, through} = Document.updates(document)

      assert Document.updates(document, after: through) == {[], through}
    end

    test "a compaction written since is read by a reader that had read past what it replaced" do
      document = document()

      {:ok, _} = Document.append(document, <<1>>, 1)
      {:ok, _} = Document.append(document, <<2>>, 2)
      {_updates, through} = Document.updates(document)
      {:ok, _} = Document.compact(document, <<1, 2>>, through)

      # The merge takes a new id, so it is after any point read before it.
      assert applied(document, after: through) == [<<1, 2>>]
    end
  end

  describe "compact/3" do
    test "one merged update replaces everything up to the point it names" do
      document = document()

      {:ok, _} = Document.append(document, <<1>>, 1)
      {:ok, _} = Document.append(document, <<2>>, 2)
      {_updates, through} = Document.updates(document)

      {:ok, _} = Document.compact(document, <<1, 2>>, through)

      assert applied(document) == [<<1, 2>>]
    end

    test "what is written after a compaction is read with it" do
      document = document()

      {:ok, _} = Document.append(document, <<1>>, 1)
      {_updates, through} = Document.updates(document)
      {:ok, _} = Document.compact(document, <<1>>, through)
      {:ok, _} = Document.append(document, <<2>>, 2)

      assert applied(document) == [<<1>>, <<2>>]
    end

    # The case the bound exists for: somebody was typing while the merge was
    # being made, and their change is not the merge's to replace.
    test "a change appended while the merge was being made survives it" do
      document = document()

      {:ok, _} = Document.append(document, <<1>>, 1)
      {_updates, through} = Document.updates(document)

      # Somebody else writes before the merge arrives.
      {:ok, _} = Document.append(document, <<2>>, 2)

      {:ok, _} = Document.compact(document, <<1>>, through)

      # In whatever order: Yjs applies updates in any, and the merge is written
      # after the change it did not include.
      assert Enum.sort(applied(document)) == [<<1>>, <<2>>]
    end

    # A full read skips nothing on the strength of a merge: whatever is left
    # below the merge's point is what the merge did not stand for.
    test "a change below the merge's point that the merge did not delete is still read" do
      document = document()

      {:ok, _} = Document.append(document, <<1>>, 1)
      {_updates, through} = Document.updates(document)
      {:ok, _} = Document.compact(document, <<1>>, through)

      # A row with an id the merge's point already passed.
      Repo.insert!(%Document.Update{id: through - 1, document_id: document.id, update: <<9>>})

      assert <<9>> in applied(document)
    end

    test "compacting twice keeps only what the furthest-reaching merge covers" do
      document = document()

      {:ok, _} = Document.append(document, <<1>>, 1)
      {_updates, first} = Document.updates(document)
      {:ok, _} = Document.compact(document, <<1>>, first)

      {:ok, _} = Document.append(document, <<2>>, 2)
      {_updates, second} = Document.updates(document)
      {:ok, _} = Document.compact(document, <<1, 2>>, second)

      assert applied(document) == [<<1, 2>>]
    end
  end

  describe "find/1" do
    test "any document may be opened by anyone" do
      document = document()

      assert {:ok, found} = Document.find(document.id)
      assert found.id == document.id
    end

    test "one that does not exist is not found" do
      assert {:error, :not_found} = Document.find(999_999)
    end
  end
end
