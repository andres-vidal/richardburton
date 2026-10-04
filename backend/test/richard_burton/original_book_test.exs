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
  alias RichardBurton.TranslatedBook

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

  defp insert(attrs) do
    attrs |> changeset() |> Repo.insert()
  end

  # Inserts the book and reads back the fingerprint the database writes once
  # its authors are linked.
  defp insert!(attrs) do
    attrs |> changeset() |> Repo.insert!() |> Repo.refresh([:authors_fingerprint])
  end

  # A changeset whose authors are already stored, as `find_or_insert!/1` builds it.
  defp changeset_linked(book, attrs), do: book |> OriginalBook.changeset(attrs) |> Author.link()

  defp maybe_preload(changeset, true), do: OriginalBook.preload(changeset)
  defp maybe_preload(changeset, false), do: changeset

  defp linked(changeset, preload: preload) do
    changeset
    |> get_change(:original_book)
    |> apply_changes
    |> maybe_preload(preload)
  end

  defp linked(changeset) do
    linked(changeset, preload: false)
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
      OriginalBook.find_or_insert!(@valid_attrs)

      # Inserted around the lookup in `find_or_insert!/1`, which would have found
      # the first book.
      %OriginalBook{} |> changeset_linked(@valid_attrs) |> Repo.insert!()

      assert {:error, :conflict} = Identity.settle()
    end

    test "has no side effects" do
      assert Enum.empty?(Author.all())
      changeset(@valid_attrs)
      assert Enum.empty?(Author.all())
    end
  end

  describe "find_or_insert/1" do
    test "when there is no original book with the provided authors and title, inserts it" do
      original_book = OriginalBook.find_or_insert!(@valid_attrs)

      assert [original_book] == OriginalBook.all()
    end

    test "when there is a original book with the provided authors and title, returns the pre-existent one" do
      insert(@valid_attrs)
      assert [pre_existent_book] = OriginalBook.all()

      original_book = OriginalBook.find_or_insert!(@valid_attrs) |> OriginalBook.preload()

      assert pre_existent_book == original_book
      assert [original_book] == OriginalBook.all()
    end

    test "the same authors in another order are the same book" do
      book = OriginalBook.find_or_insert!(@valid_attrs)

      again =
        OriginalBook.find_or_insert!(%{
          @valid_attrs
          | "authors" => Enum.reverse(@valid_attrs["authors"])
        })

      assert again.id == book.id
    end

    test "the same title by other authors is another book" do
      book = OriginalBook.find_or_insert!(@valid_attrs)

      other =
        OriginalBook.find_or_insert!(%{
          @valid_attrs
          | "authors" => [%{"name" => "Erico Verissimo"}]
        })

      refute other.id == book.id
      assert length(OriginalBook.all()) == 2
    end
  end

  describe "link/1" do
    @translated_book_attrs %{
      "authors" => [
        %{"name" => "Richard Burton"},
        %{"name" => "Isabel Burton"}
      ],
      "original_book" => %{
        "title" => "Dom Casmurro",
        "authors" => [%{"name" => "Machado de Assis"}]
      }
    }

    test "links existing original book to TranslatedBook changeset" do
      original_book = insert!(@translated_book_attrs["original_book"])

      changeset =
        %TranslatedBook{}
        |> TranslatedBook.changeset(@translated_book_attrs)
        |> OriginalBook.link()

      assert changeset.valid?

      assert original_book == linked(changeset, preload: true)
    end

    test "links non-existing authors to TranslatedBook changeset, inserting them" do
      changeset =
        %TranslatedBook{}
        |> TranslatedBook.changeset(@translated_book_attrs)
        |> OriginalBook.link()

      assert changeset.valid?

      assert OriginalBook.all() == [linked(changeset)]
    end

    test "has no side effects when TranslatedBook changeset is invalid" do
      changeset =
        %TranslatedBook{}
        |> TranslatedBook.changeset(%{})
        |> OriginalBook.link()

      refute changeset.valid?

      assert Enum.empty?(OriginalBook.all())
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
      OriginalBook.find_or_insert!(%{
        "title" => "Dom Casmurro",
        "authors" => [%{"name" => "Machado de Assis"}]
      })

      OriginalBook.find_or_insert!(%{
        "title" => "Memórias Póstumas",
        "authors" => [%{"name" => "Machado de Assis"}]
      })

      # Two of its authors answer to "J. M.", so a search for that would find
      # this book twice if the rows were not deduplicated.
      OriginalBook.find_or_insert!(%{
        "title" => "Manuel de Moraes",
        "authors" => [
          %{"name" => "Machado de Assis"},
          %{"name" => "J. M. Pereira da Silva"},
          %{"name" => "J. M. Velho da Silva"}
        ]
      })

      :ok
    end
  end
end
