defmodule RichardBurton.TranslatedBookTest do
  @moduledoc """
  Tests for the TranslatedBook schema
  """

  use RichardBurton.DataCase

  alias RichardBurton.Author
  alias RichardBurton.Identity
  alias RichardBurton.TranslatedBook
  alias RichardBurton.OriginalBook
  alias RichardBurton.Util

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
      book = original_book_fixture("Manuel de Moraes", ["J. M. Pereira da Silva"])
      translated_book_fixture(book, ["Isabel Burton", "Richard Burton"])
      translated_book_fixture(book, ["Richard Burton", "Isabel Burton"])

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
end
