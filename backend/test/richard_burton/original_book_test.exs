defmodule RichardBurton.OriginalBookTest do
  @moduledoc """
  Tests for the OriginalBook schema
  """

  use RichardBurton.DataCase

  alias RichardBurton.Author
  alias RichardBurton.Util
  alias RichardBurton.OriginalBook
  alias RichardBurton.TranslatedBook
  alias RichardBurton.Validation

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

  defp insert!(attrs) do
    attrs |> changeset() |> Repo.insert!()
  end

  defp maybe_preload(changeset, true), do: OriginalBook.preload(changeset)
  defp maybe_preload(changeset, false), do: changeset

  defp linked(changeset, preload: preload) do
    changeset
    |> get_change(:original_book)
    |> apply_changes()
    |> maybe_preload(preload)
  end

  defp linked(changeset) do
    linked(changeset, preload: false)
  end

  defp linked_fingerprint(changeset = %Ecto.Changeset{}) do
    get_change(changeset, :original_book_fingerprint)
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

    test "when a original book with the provided attributes already exists, is invalid" do
      {:ok, _} = insert(@valid_attrs)
      {:error, changeset} = insert(@valid_attrs)

      refute changeset.valid?
      assert :conflict == Validation.get_errors(changeset)
    end

    test "has no side effects" do
      assert Enum.empty?(Author.all())
      changeset(@valid_attrs)
      assert Enum.empty?(Author.all())
    end
  end

  describe "maybe_insert/1" do
    test "when there is no original book with the provided authors and title, inserts it" do
      original_book = OriginalBook.maybe_insert!(@valid_attrs)

      assert [original_book] == OriginalBook.all()
    end

    test "when there is a original book with the provided authors and title, returns the pre-existent one" do
      insert(@valid_attrs)
      assert [pre_existent_book] = OriginalBook.all()

      original_book = OriginalBook.maybe_insert!(@valid_attrs) |> OriginalBook.preload()

      assert pre_existent_book == original_book
      assert [original_book] == OriginalBook.all()
    end

    test "translated books with diferrent authors must have different authors fingerprint" do
      changeset1 = change_valid(%{"authors" => [%{"name" => "Machado de Assis"}]})
      changeset2 = change_valid(%{"authors" => [%{"name" => "Erico Verissimo"}]})

      authors_fingerprint1 = Ecto.Changeset.get_field(changeset1, :authors_fingerprint)
      authors_fingerprint2 = Ecto.Changeset.get_field(changeset2, :authors_fingerprint)

      refute authors_fingerprint1 == authors_fingerprint2
    end
  end

  describe "fingerprint/1" do
    test "given two original_books with different title, generates different fingerprints" do
      original_book1 = %OriginalBook{title: "Iracema", authors_fingerprint: "ABC"}
      original_book2 = %OriginalBook{title: "Ubirajara", authors_fingerprint: "ABC"}

      refute OriginalBook.fingerprint(original_book1) == OriginalBook.fingerprint(original_book2)
    end

    test "given two original_books with different authors_fingerprint, generates different fingerprints" do
      original_book1 = %OriginalBook{title: "Iracema", authors_fingerprint: "ABC"}
      original_book2 = %OriginalBook{title: "Iracema", authors_fingerprint: "ABD"}

      refute OriginalBook.fingerprint(original_book1) == OriginalBook.fingerprint(original_book2)
    end

    test "given two original_books with the same title and authors_fingerprint, generates the same fingerprints" do
      original_book1 = %OriginalBook{title: "Iracema", authors_fingerprint: "ABC"}
      original_book2 = %OriginalBook{title: "Iracema", authors_fingerprint: "ABC"}

      assert OriginalBook.fingerprint(original_book1) == OriginalBook.fingerprint(original_book2)
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

  describe "link_fingerprint/1" do
    test "links fingerprint using to TranslatedBook changeset" do
      changeset =
        %TranslatedBook{}
        |> TranslatedBook.changeset(@translated_book_attrs)
        |> OriginalBook.link_fingerprint()

      assert changeset.valid?

      assert OriginalBook.fingerprint(linked(changeset)) == linked_fingerprint(changeset)
    end

    test "does not link fingerprint to invalid TranslatedBook changeset" do
      changeset =
        %TranslatedBook{}
        |> TranslatedBook.changeset(%{})
        |> OriginalBook.link_fingerprint()

      refute changeset.valid?

      assert is_nil(linked_fingerprint(changeset))
    end
  end
end
