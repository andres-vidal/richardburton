defmodule RichardBurton.DocumentTest do
  @moduledoc """
  Tests for import documents: the shared list of them, and the updates each
  one's content is made of.
  """
  use RichardBurton.DataCase

  alias RichardBurton.Document
  alias RichardBurton.Repo

  defp document(name \\ "Second pass") do
    {:ok, document} = Document.create(%{"name" => name})
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

  describe "all/0" do
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
  end

  describe "updates/1 and append/3" do
    test "hands back what was appended, in the order it was written" do
      document = document()

      {:ok, _} = Document.append(document, <<1, 2, 3>>, 1)
      {:ok, _} = Document.append(document, <<4, 5>>, 2)

      assert Document.updates(document) == [<<1, 2, 3>>, <<4, 5>>]
    end

    test "each document's updates are its own" do
      one = document("One")
      another = document("Another")

      {:ok, _} = Document.append(one, <<1>>, 1)
      {:ok, _} = Document.append(another, <<2>>, 1)

      assert Document.updates(one) == [<<1>>]
      assert Document.updates(another) == [<<2>>]
    end

    test "the row count is the client's word, recorded as given" do
      document = document()

      {:ok, _} = Document.append(document, <<1>>, 428)

      assert Repo.get(Document, document.id).rows == 428
    end

    test "a document nobody has written to has nothing to apply" do
      assert Document.updates(document()) == []
    end
  end

  describe "compact/2" do
    test "one merged update replaces everything behind it" do
      document = document()

      {:ok, _} = Document.append(document, <<1>>, 1)
      {:ok, _} = Document.append(document, <<2>>, 2)
      {:ok, _} = Document.compact(document, <<1, 2>>)

      assert Document.updates(document) == [<<1, 2>>]
    end

    test "what is written after a compaction is read with it" do
      document = document()

      {:ok, _} = Document.append(document, <<1>>, 1)
      {:ok, _} = Document.compact(document, <<1>>)
      {:ok, _} = Document.append(document, <<2>>, 2)

      assert Document.updates(document) == [<<1>>, <<2>>]
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
