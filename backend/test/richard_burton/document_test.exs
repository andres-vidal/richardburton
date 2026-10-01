defmodule RichardBurton.DocumentTest do
  @moduledoc """
  Tests for import documents: the shared list, the updates that make up each
  document's content, and archiving.
  """
  use RichardBurton.DataCase

  alias RichardBurton.Document
  alias RichardBurton.Repo

  defp document(name \\ "Second pass"), do: document_fixture(name)

  # Returns only the updates from `Document.updates/2`, without `through`.
  defp applied(document, opts \\ []) do
    {updates, _through} = Document.updates(document, opts)
    updates
  end

  # Returns the ids of the documents on a page of the list, in list order.
  defp listed(opts \\ []),
    do: opts |> Document.page() |> Map.fetch!(:entries) |> Enum.map(& &1.id)

  # Sets a document's `updated_at` to `moment`, so the test sets the list order
  # instead of depending on insert timing. The moment is given microsecond
  # precision to match the column.
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
      # The list is shared, so it is not scoped to an owner.
      one = document("Mine")
      another = document("Somebody else's")

      assert Enum.sort(listed()) == Enum.sort([one.id, another.id])
    end

    test "most recently changed first" do
      newer = document("Newer")
      # `older` is created after `newer`. Giving it an old `updated_at` checks
      # that the list orders by last change, not by creation.
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

    # `older` is changed a moment after `newer` is created. With whole-second
    # timestamps the two could tie, and the tie would go to `newer`, the one
    # created later.
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

    # A document changed between two reads moves to the top of the list. With
    # an offset, every document below it would shift by one. The cursor keeps
    # the next page from repeating a document.
    test "a document changed between reads is not read twice" do
      first = document("First") |> changed_at(~N[2026-09-03 00:00:00])
      second = document("Second") |> changed_at(~N[2026-09-02 00:00:00])
      third = document("Third") |> changed_at(~N[2026-09-01 00:00:00])

      assert listed(limit: 2) == [first.id, second.id]

      # An update is appended to the last document on the page already read.
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

      # The merged update gets a new id, larger than any id read before it.
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

    # This is the case `through` exists for. An update appended while the merge
    # was being built is not in the merge, so the compaction must keep it.
    test "a change appended while the merge was being made survives it" do
      document = document()

      {:ok, _} = Document.append(document, <<1>>, 1)
      {_updates, through} = Document.updates(document)

      # Another update is appended before the compaction is written.
      {:ok, _} = Document.append(document, <<2>>, 2)

      {:ok, _} = Document.compact(document, <<1>>, through)

      # The order is not checked, because Yjs applies updates in any order. The
      # merged update is inserted after the update it does not include.
      assert Enum.sort(applied(document)) == [<<1>>, <<2>>]
    end

    # A read does not skip updates because of a compaction. Any update left
    # below the compaction's `through` is one the compaction did not include.
    test "a change below the merge's point that the merge did not delete is still read" do
      document = document()

      {:ok, _} = Document.append(document, <<1>>, 1)
      {_updates, through} = Document.updates(document)
      {:ok, _} = Document.compact(document, <<1>>, through)

      # An update with an id below the compaction's `through`.
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
