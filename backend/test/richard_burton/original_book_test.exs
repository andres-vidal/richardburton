defmodule RichardBurton.OriginalBookTest do
  @moduledoc """
  Tests for the OriginalBook schema
  """

  use RichardBurton.DataCase

  alias RichardBurton.Author
  alias RichardBurton.Identity

  doctest RichardBurton.OriginalBook
  alias RichardBurton.Util
  alias RichardBurton.OriginalBook

  @valid_attrs %{
    "title" => "Manuel de Moraes: crônica do século XVII",
    "authors" => [
      %{"name" => "J. M. Pereira da Silva"},
      %{"name" => "Machado de Assis"}
    ]
  }

  defp changeset(attrs = %{}) do
    OriginalBook.changeset(%OriginalBook{}, attrs)
  end

  defp change_valid(attrs = %{}) do
    changeset(Util.deep_merge_maps(@valid_attrs, attrs))
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

    test "when authors is missing, is invalid" do
      refute changeset(Map.delete(@valid_attrs, "authors")).valid?
    end

    test "when authors is nil, is invalid" do
      refute change_valid(%{"authors" => nil}).valid?
    end

    test "when authors is empty, is invalid" do
      refute change_valid(%{"authors" => []}).valid?
    end

    test "when an author is invalid, is invalid" do
      refute change_valid(%{"authors" => [%{"name" => nil}]}).valid?
    end

    test "the database refuses a second original book with the same title and authors" do
      authors = ["J. M. Pereira da Silva", "Machado de Assis"]
      original_book_fixture("Manuel de Moraes", authors)
      original_book_fixture("Manuel de Moraes", Enum.reverse(authors))

      assert {:error, :conflict} = Identity.settle()
    end

    test "has no side effects" do
      assert Enum.empty?(Author.all())
      changeset(@valid_attrs)
      assert Enum.empty?(Author.all())
    end
  end

  describe "search/1" do
    setup [:search_fixture]

    test "finds a book by the start of its title" do
      assert ["Dom Casmurro"] = titles(OriginalBook.search("Dom Cas"))
    end

    test "finds a book by the start of an author's name" do
      # The book is entered as a unit, so knowing either half is enough to
      # find it.
      assert ["Dom Casmurro", "Manuel de Moraes", "Memórias Póstumas"] =
               titles(OriginalBook.search("Machado"))
    end

    test "answers each book once, however many of its authors match" do
      assert ["Manuel de Moraes"] = titles(OriginalBook.search("J. M."))
    end

    test "falls back to similar spellings when nothing starts that way" do
      assert [] == OriginalBook.search("Machada", :prefix)

      assert ["Dom Casmurro", "Manuel de Moraes", "Memórias Póstumas"] =
               titles(OriginalBook.search("Machada"))
    end

    test "carries the authors of every book it finds" do
      assert [book] = OriginalBook.search("Dom Cas")
      assert Author.flatten(book.authors) == ["Machado de Assis"]
    end

    defp titles(books), do: Enum.map(books, & &1.title)

    defp search_fixture(_context) do
      original_book_fixture("Dom Casmurro", ["Machado de Assis"])
      original_book_fixture("Memórias Póstumas", ["Machado de Assis"])

      # Two of its authors answer to "J. M.", so a search for that would find
      # this book twice if the rows were not deduplicated.
      original_book_fixture("Manuel de Moraes", [
        "Machado de Assis",
        "J. M. Pereira da Silva",
        "J. M. Velho da Silva"
      ])

      :ok
    end
  end
end
