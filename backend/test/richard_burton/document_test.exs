defmodule RichardBurton.DocumentTest do
  @moduledoc """
  Tests for import documents: the shared list of them, the updates each one's
  content is made of, and what taking one off the list means.
  """
  use RichardBurton.DataCase

  alias RichardBurton.Document
  alias RichardBurton.Repo

  defp document(name \\ "Second pass") do
    {:ok, document} = Document.create(%{"name" => name})
    document
  end

  # Just the bytes, for the cases where the point is what a reader would apply
  # rather than how far the read reaches.
  defp applied(document) do
    {updates, _through} = Document.updates(document)
    updates
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

  describe "all/1" do
    test "lists every document, whoever started it" do
      # The list is shared: there is no owner to scope it to.
      one = document("Mine")
      another = document("Somebody else's")

      assert Enum.map(Document.all(), & &1.id) |> Enum.sort() ==
               Enum.sort([one.id, another.id])
    end

    test "most recently changed first" do
      newer = document("Newer")
      older = document("Older")

      # Aged deliberately: both were started in the same second, and the point
      # is which was last *changed*, not which was started.
      {:ok, older} =
        older
        |> Ecto.Changeset.change(updated_at: ~N[2020-01-01 00:00:00])
        |> Repo.update()

      assert [first, second] = Document.all()
      assert first.id == newer.id
      assert second.id == older.id
    end

    test "a page of them, so a long-kept workspace does not read its whole table" do
      for name <- ["One", "Two", "Three"], do: document(name)

      assert length(Document.all(limit: 2)) == 2
      assert length(Document.all(limit: 2, offset: 2)) == 1
      assert Document.count() == 3
    end

    test "an asking-for-everything limit is bounded rather than honoured" do
      document()

      assert length(Document.all(limit: 10_000)) == 1
    end

    test "archived documents are not on it" do
      kept = document("Kept")
      {:ok, _} = document("Retired") |> Document.archive()

      assert Enum.map(Document.all(), & &1.id) == [kept.id]
      assert Document.count() == 1
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
      assert Enum.map(Document.all(), & &1.id) == [restored.id]
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

    test "a count that is not one leaves the count alone rather than refusing the change" do
      document = document()
      {:ok, _} = Document.append(document, <<1>>, 7)

      {:ok, _} = Document.append(document, <<2>>, "not a number")

      assert Repo.get(Document, document.id).rows == 7
      assert applied(document) == [<<1>>, <<2>>]
    end

    test "a document nobody has written to has nothing to apply" do
      assert applied(document()) == []
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

      assert applied(document) == [<<1>>, <<2>>]
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
