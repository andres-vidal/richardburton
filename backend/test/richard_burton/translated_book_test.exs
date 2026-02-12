defmodule RichardBurton.TranslatedBookTest do
  @moduledoc """
  Tests for the TranslatedBook schema
  """

  use RichardBurton.DataCase

  alias RichardBurton.Author
  alias RichardBurton.TranslatedBook
  alias RichardBurton.OriginalBook
  alias RichardBurton.Publication
  alias RichardBurton.Util
  alias RichardBurton.Validation

  @valid_attrs %{
    "authors" => [
      %{"name" => "Richard Burton"},
      %{"name" => "Isabel Burton"}
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

  defp insert!(attrs) do
    attrs |> changeset() |> Repo.insert!()
  end

  defp maybe_preload(changeset, true), do: TranslatedBook.preload(changeset)
  defp maybe_preload(changeset, false), do: changeset

  defp linked(changeset, preload: preload) do
    changeset
    |> get_change(:translated_book)
    |> apply_changes()
    |> maybe_preload(preload)
  end

  defp linked(changeset) do
    linked(changeset, preload: false)
  end

  defp linked_fingerprint(changeset = %Ecto.Changeset{}) do
    get_change(changeset, :translated_book_fingerprint)
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

    test "when a translated book with the provided attributes already exists, is invalid" do
      {:ok, _} = insert(@valid_attrs)
      {:error, changeset} = insert(@valid_attrs)

      refute changeset.valid?
      assert :conflict == Validation.get_errors(changeset)
    end

    test "translated books with diferrent authors must have different authors fingerprint" do
      changeset1 = change_valid(%{"authors" => [%{"name" => "John Gledson"}]})
      changeset2 = change_valid(%{"authors" => [%{"name" => "Helen Caldwell"}]})

      authors_fingerprint1 = Ecto.Changeset.get_field(changeset1, :authors_fingerprint)
      authors_fingerprint2 = Ecto.Changeset.get_field(changeset2, :authors_fingerprint)

      refute authors_fingerprint1 == authors_fingerprint2
    end

    test "has no side effects" do
      assert Enum.empty?(Author.all())
      assert Enum.empty?(OriginalBook.all())
      changeset(@valid_attrs)
      assert Enum.empty?(Author.all())
      assert Enum.empty?(OriginalBook.all())
    end
  end

  describe "maybe_insert/1" do
    test "when there is no translated book with the provided authors and original book, inserts it" do
      translated_book = TranslatedBook.maybe_insert!(@valid_attrs)

      assert [translated_book] == TranslatedBook.all()
    end

    test "when there is a translated book with the provided authors and original book, returns the pre-existent one" do
      insert(@valid_attrs)
      assert [pre_existent_book] = TranslatedBook.all()

      translated_book = TranslatedBook.maybe_insert!(@valid_attrs) |> TranslatedBook.preload()

      assert pre_existent_book == translated_book
      assert [translated_book] == TranslatedBook.all()
    end
  end

  describe "fingerprint/1" do
    test "given two translated_books with different original_book_fingerprint, generates different fingerprints" do
      translated_book1 = %TranslatedBook{
        original_book_fingerprint: "DEF",
        authors_fingerprint: "ABC"
      }

      translated_book2 = %TranslatedBook{
        original_book_fingerprint: "DEG",
        authors_fingerprint: "ABC"
      }

      refute TranslatedBook.fingerprint(translated_book1) ==
               TranslatedBook.fingerprint(translated_book2)
    end

    test "given two translated_books with different authors_fingerprint, generates different fingerprints" do
      translated_book1 = %TranslatedBook{
        original_book_fingerprint: "DEF",
        authors_fingerprint: "ABC"
      }

      translated_book2 = %TranslatedBook{
        original_book_fingerprint: "DEF",
        authors_fingerprint: "ABD"
      }

      refute TranslatedBook.fingerprint(translated_book1) ==
               TranslatedBook.fingerprint(translated_book2)
    end

    test "given two translated_books with the same original_book_fingerprint and authors_fingerprint, generates the same fingerprints" do
      translated_book1 = %TranslatedBook{
        original_book_fingerprint: "DEF",
        authors_fingerprint: "ABC"
      }

      translated_book2 = %TranslatedBook{
        original_book_fingerprint: "DEF",
        authors_fingerprint: "ABC"
      }

      assert TranslatedBook.fingerprint(translated_book1) ==
               TranslatedBook.fingerprint(translated_book2)
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
          %{"name" => "Richard Burton"},
          %{"name" => "Isabel Burton"}
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

  describe "link_fingerprint/1" do
    test "links fingerprint using to Publication changeset" do
      changeset =
        %Publication{}
        |> Publication.changeset(@publication_attrs)
        |> TranslatedBook.link_fingerprint()

      assert changeset.valid?

      assert TranslatedBook.fingerprint(linked(changeset)) == linked_fingerprint(changeset)
    end

    test "does not link fingerprint to invalid Publication changeset" do
      changeset =
        %Publication{}
        |> Publication.changeset(%{})
        |> TranslatedBook.link_fingerprint()

      refute changeset.valid?

      assert is_nil(linked_fingerprint(changeset))
    end
  end
end
