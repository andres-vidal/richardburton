defmodule RichardBurton.TranslatedBookTest do
  @moduledoc """
  Tests for the TranslatedBook schema
  """

  use RichardBurton.DataCase

  alias RichardBurton.Author
  alias RichardBurton.Identity
  alias RichardBurton.TranslatedBook
  alias RichardBurton.OriginalBook
  alias RichardBurton.Publication
  alias RichardBurton.Util

  # The translators are listed in the order a preload reads them, so that a
  # book inserted from these attrs equals the same book read back.
  @valid_attrs %{
    "authors" => [
      %{"name" => "Isabel Burton"},
      %{"name" => "Richard Burton"}
    ],
    "original_book" => %{
      "title" => "Manuel de Moraes: crônica do século XVII",
      "authors" => [
        %{"name" => "J. M. Pereira da Silva"}
      ]
    }
  }

  defp changeset(attrs = %{}) do
    TranslatedBook.changeset(%TranslatedBook{}, attrs)
  end

  defp change_valid(attrs = %{}) do
    changeset(Util.deep_merge_maps(@valid_attrs, attrs))
  end

  defp insert(attrs) do
    attrs |> changeset() |> Repo.insert()
  end

  # Inserts the book, with its original book, and reads back the fingerprints
  # the database writes once their authors are linked.
  defp insert!(attrs) do
    book = attrs |> changeset() |> Repo.insert!() |> Repo.refresh([:authors_fingerprint])

    %{book | original_book: Repo.refresh(book.original_book, [:authors_fingerprint])}
  end

  defp maybe_preload(changeset, true), do: TranslatedBook.preload(changeset)
  defp maybe_preload(changeset, false), do: changeset

  defp linked(changeset, preload: preload) do
    changeset
    |> get_change(:translated_book)
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

    test "when original book is missing, is invalid" do
      refute changeset(Map.delete(@valid_attrs, "original_book")).valid?
    end

    test "when original book is invalid, is invalid" do
      refute change_valid(%{"original_book" => %{"title" => nil}}).valid?
    end

    test "when original book is nil, is invalid" do
      refute change_valid(%{"original_book" => nil}).valid?
    end

    test "the database refuses a second translated book of one original book by the same translators" do
      TranslatedBook.find_or_insert!(@valid_attrs)

      # Inserted around the lookup in `find_or_insert!/1`, which would have found
      # the first book.
      %TranslatedBook{}
      |> TranslatedBook.changeset(@valid_attrs)
      |> OriginalBook.link()
      |> Author.link()
      |> Repo.insert!()

      assert {:error, :conflict} = Identity.settle()
    end

    test "has no side effects" do
      assert Enum.empty?(Author.all())
      assert Enum.empty?(OriginalBook.all())
      changeset(@valid_attrs)
      assert Enum.empty?(Author.all())
      assert Enum.empty?(OriginalBook.all())
    end
  end

  describe "find_or_insert/1" do
    test "when there is no translated book with the provided authors and original book, inserts it" do
      translated_book = TranslatedBook.find_or_insert!(@valid_attrs)

      assert [translated_book] == TranslatedBook.all()
    end

    test "when there is a translated book with the provided authors and original book, returns the pre-existent one" do
      insert(@valid_attrs)
      assert [pre_existent_book] = TranslatedBook.all()

      translated_book = TranslatedBook.find_or_insert!(@valid_attrs) |> TranslatedBook.preload()

      assert pre_existent_book == translated_book
      assert [translated_book] == TranslatedBook.all()
    end

    test "the same translators in another order are the same translated book" do
      book = TranslatedBook.find_or_insert!(@valid_attrs)

      again =
        TranslatedBook.find_or_insert!(%{
          @valid_attrs
          | "authors" => Enum.reverse(@valid_attrs["authors"])
        })

      assert again.id == book.id
    end

    test "the same original book by other translators is another translated book" do
      book = TranslatedBook.find_or_insert!(@valid_attrs)

      other =
        TranslatedBook.find_or_insert!(%{
          @valid_attrs
          | "authors" => [%{"name" => "John Gledson"}]
        })

      refute other.id == book.id
      assert other.original_book_id == book.original_book_id
    end
  end

  describe "link/1" do
    @publication_attrs %{
      "title" => "Manuel de Moraes: A Chronicle of the Seventeenth Century",
      "countries" => [%{"code" => "GB"}],
      "year" => 1886,
      "publishers" => [%{"name" => "Bickers & Son"}],
      "translated_book" => %{
        "authors" => [
          %{"name" => "Isabel Burton"},
          %{"name" => "Richard Burton"}
        ],
        "original_book" => %{
          "authors" => [
            %{"name" => "J. M. Pereira da Silva"}
          ],
          "title" => "Manuel de Moraes: crônica do século XVII"
        }
      }
    }

    test "links existing original book to Publication changeset" do
      original_book = insert!(@publication_attrs["translated_book"])

      changeset =
        %Publication{}
        |> Publication.changeset(@publication_attrs)
        |> TranslatedBook.link()

      assert changeset.valid?

      assert original_book == linked(changeset, preload: true)
    end

    test "links non-existing authors to Publication changeset, inserting them" do
      changeset =
        %Publication{}
        |> Publication.changeset(@publication_attrs)
        |> TranslatedBook.link()

      assert changeset.valid?

      assert TranslatedBook.all() == [linked(changeset)]
    end

    test "has no side effects when Publication changeset is invalid" do
      changeset =
        %Publication{}
        |> Publication.changeset(%{})
        |> TranslatedBook.link()

      refute changeset.valid?

      assert Enum.empty?(TranslatedBook.all())
    end
  end
end
