defmodule RichardBurton.ConcurrentNamesTest do
  @moduledoc """
  Tests for two writes that store the same new name at once, raced with
  `RichardBurton.Race`: an author, a publisher or a country that neither write
  found stored when it looked.
  """

  use RichardBurton.DataCase

  alias RichardBurton.Author
  alias RichardBurton.Country
  alias RichardBurton.Publication
  alias RichardBurton.Publisher
  alias RichardBurton.Race

  @tables ~w[publication_history publication_sources publication_publishers publication_countries
             publication_distinctions publications translated_book_authors translated_books
             original_book_authors original_books authors publishers countries]

  setup do
    on_exit(fn -> Race.truncate!(@tables) end)
  end

  defp count(table), do: Race.unboxed(fn -> Repo.query!("SELECT count(*) FROM #{table}").rows end)

  test "two writes that store the same new author at once both get the one author" do
    write = fn -> Author.maybe_insert!(%{"name" => "Helen Caldwell"}) end

    assert %{first: first, second: second, waited: true} = Race.run(write, write)
    assert first.id == second.id
    assert count("authors") == [[1]]
  end

  test "two writes that store the same new publisher at once both get the one publisher" do
    write = fn -> Publisher.maybe_insert!(%{"name" => "Noonday Press"}) end

    assert %{first: first, second: second, waited: true} = Race.run(write, write)
    assert first.id == second.id
    assert count("publishers") == [[1]]
  end

  test "two writes that store the same new country at once both get the one country" do
    write = fn -> Country.maybe_insert!(%{"code" => "BR"}) end

    assert %{first: first, second: second, waited: true} = Race.run(write, write)
    assert first.id == second.id
    assert count("countries") == [[1]]
  end

  test "two publications of different books that share new names, inserted at once, are both stored" do
    # Both are Machado de Assis in Helen Caldwell's translation, published by
    # Noonday Press in the United States, and none of those names is stored yet.
    dom_casmurro = %{
      "title" => "Dom Casmurro",
      "year" => 1953,
      "countries" => [%{"code" => "US"}],
      "publishers" => [%{"name" => "Noonday Press"}],
      "translated_book" => %{
        "authors" => [%{"name" => "Helen Caldwell"}],
        "original_book" => %{
          "title" => "Dom Casmurro",
          "authors" => [%{"name" => "Machado de Assis"}]
        }
      }
    }

    counselor_ayres =
      dom_casmurro
      |> Map.put("title", "Counselor Ayres' Memorial")
      |> put_in(["translated_book", "original_book", "title"], "Memorial de Aires")

    assert %{first: {:ok, _}, second: {:ok, _}, waited: true} =
             Race.run(
               fn -> Publication.insert(dom_casmurro) end,
               fn -> Publication.insert(counselor_ayres) end
             )

    assert count("publications") == [[2]]
    assert count("authors") == [[2]]
    assert count("publishers") == [[1]]
    assert count("countries") == [[1]]
  end
end
