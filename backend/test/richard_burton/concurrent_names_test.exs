defmodule RichardBurton.ConcurrentNamesTest do
  @moduledoc """
  Tests for two writes that store the same new names at once, raced with
  `RichardBurton.RaceCase`: an author, a publisher and a country that neither
  write found stored when it looked.
  """

  use RichardBurton.RaceCase

  alias RichardBurton.Publication

  # Dom Casmurro, in Helen Caldwell's translation, published by Noonday Press
  # in the United States.
  @dom_casmurro %{
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

  # Another book by Machado de Assis with the same translator, publisher and
  # country as `@dom_casmurro`.
  @counselor_ayres @dom_casmurro
                   |> Map.put("title", "Counselor Ayres' Memorial")
                   |> put_in(["translated_book", "original_book", "title"], "Memorial de Aires")

  defp count(table), do: unboxed(fn -> Repo.query!("SELECT count(*) FROM #{table}").rows end)

  test "two publications of different books that share new names, inserted at once, are both stored" do
    # None of the names is stored yet.
    assert %{first: {:ok, _}, second: {:ok, _}, waited: true} =
             race(
               fn -> Publication.insert(@dom_casmurro) end,
               fn -> Publication.insert(@counselor_ayres) end
             )

    assert count("publications") == [[2]]
    assert count("authors") == [[2]]
    assert count("publishers") == [[1]]
    assert count("countries") == [[1]]
  end

  test "two imports of different books that share new names, at once, are both stored" do
    # None of the names is stored yet.
    assert %{first: {:ok, _}, second: {:ok, _}, waited: true} =
             race(
               fn -> Publication.insert_all([@dom_casmurro]) end,
               fn -> Publication.insert_all([@counselor_ayres]) end
             )

    assert count("publications") == [[2]]
    assert count("authors") == [[2]]
    assert count("publishers") == [[1]]
    assert count("countries") == [[1]]
  end

  test "an edit and an insert that add the same new publisher at once both get the one publisher" do
    {:ok, stored} = unboxed(fn -> Publication.insert(@dom_casmurro) end)
    with_knopf = &Map.put(&1, "publishers", [%{"name" => "Knopf"}])

    assert %{first: {:ok, _}, second: {:ok, _}, waited: true} =
             race(
               fn -> Publication.update(stored.id, with_knopf.(@dom_casmurro)) end,
               fn -> Publication.insert(with_knopf.(@counselor_ayres)) end
             )

    assert count("publishers WHERE name = 'Knopf'") == [[1]]
    assert count("publication_publishers") == [[2]]
  end
end
