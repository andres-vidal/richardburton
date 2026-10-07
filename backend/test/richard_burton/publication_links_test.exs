defmodule RichardBurton.Publication.LinksTest do
  @moduledoc """
  Tests for `Publication.Links`: which stored rows an entry links to, which rows
  it inserts, and when two entries name the same book.
  """
  use RichardBurton.DataCase

  alias RichardBurton.Author
  alias RichardBurton.Country
  alias RichardBurton.OriginalBook
  alias RichardBurton.Publication
  alias RichardBurton.Publication.Codec
  alias RichardBurton.Publication.Links
  alias RichardBurton.TranslatedBook

  @dom_casmurro %{
    title: "Dom Casmurro",
    year: 1953,
    countries: ["US"],
    publishers: ["Noonday Press"],
    authors: ["Helen Caldwell"],
    original_title: "Dom Casmurro",
    original_authors: ["Machado de Assis"]
  }

  # Returns `@dom_casmurro`, with `changes` merged in, as an entry.
  defp entry(changes \\ %{}) do
    %Publication{}
    |> Publication.changeset(Codec.nest(Map.merge(@dom_casmurro, changes)))
    |> apply_changes()
  end

  # Returns the id of the original book that `links` leads to.
  defp original_book_id(links),
    do: Repo.get!(TranslatedBook, links.translated_book_id).original_book_id

  # Returns the ids that `links` holds.
  defp ids(links) do
    %{
      links
      | countries: Enum.map(links.countries, & &1.id),
        publishers: Enum.map(links.publishers, & &1.id)
    }
  end

  test "inserts the names and books an entry names, and finds them the next time" do
    [first] = Links.resolve([entry()])
    [again] = Links.resolve([entry()])

    assert ids(again) == ids(first)
    assert Repo.aggregate(Author, :count) == 2
    assert Repo.aggregate(OriginalBook, :count) == 1
    assert Repo.aggregate(TranslatedBook, :count) == 1
  end

  test "stores a new country with the names it is searched by" do
    [%{countries: [country]}] = Links.resolve([entry(%{countries: ["BR"]})])

    assert country.names == Country.names_for("BR")
  end

  test "returns countries and publishers in the order the entry lists them" do
    [links] =
      Links.resolve([entry(%{countries: ["US", "BR"], publishers: ["Noonday Press", "Knopf"]})])

    assert Enum.map(links.countries, & &1.code) == ["US", "BR"]
    assert Enum.map(links.publishers, & &1.name) == ["Noonday Press", "Knopf"]
  end

  test "gives entries in one list that name the same new book one book" do
    [first, second] =
      Links.resolve([
        entry(%{authors: ["Helen Caldwell", "John Gledson"]}),
        entry(%{year: 1960, authors: ["John Gledson", "Helen Caldwell"]})
      ])

    assert second.translated_book_id == first.translated_book_id
    assert Repo.aggregate(TranslatedBook, :count) == 1
  end

  describe "an original book" do
    test "is the same book with its authors in another order" do
      authors = ["Machado de Assis", "José de Alencar"]
      [first] = Links.resolve([entry(%{original_authors: authors})])
      [again] = Links.resolve([entry(%{original_authors: Enum.reverse(authors)})])

      assert original_book_id(again) == original_book_id(first)
    end

    test "is another book with another title or other authors" do
      [first] = Links.resolve([entry()])
      [retitled] = Links.resolve([entry(%{original_title: "Memorial de Aires"})])
      [reauthored] = Links.resolve([entry(%{original_authors: ["José de Alencar"]})])

      assert original_book_id(retitled) != original_book_id(first)
      assert original_book_id(reauthored) != original_book_id(first)
    end
  end

  describe "a translated book" do
    test "is the same book with its translators in another order" do
      translators = ["Helen Caldwell", "John Gledson"]
      [first] = Links.resolve([entry(%{authors: translators})])
      [again] = Links.resolve([entry(%{authors: Enum.reverse(translators)})])

      assert again.translated_book_id == first.translated_book_id
    end

    test "of the same original book by other translators is another book" do
      [first] = Links.resolve([entry()])
      [other] = Links.resolve([entry(%{authors: ["John Gledson"]})])

      assert original_book_id(other) == original_book_id(first)
      assert other.translated_book_id != first.translated_book_id
    end
  end
end
