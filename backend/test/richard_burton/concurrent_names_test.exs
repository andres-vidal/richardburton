defmodule RichardBurton.ConcurrentNamesTest do
  @moduledoc """
  Tests for two writes that store the same new names at once, raced with
  `RichardBurton.RaceCase`: an author, a publisher and a country that neither
  write found stored when it looked.
  """

  use RichardBurton.RaceCase

  alias RichardBurton.Publication

  # Another book by Machado de Assis, with the same translator, publisher and
  # country as the publication `publication_attrs/1` starts from.
  @counselor_ayres %{title: "Counselor Ayres' Memorial", original_title: "Memorial de Aires"}

  defp count(table), do: unboxed(fn -> Repo.query!("SELECT count(*) FROM #{table}").rows end)

  test "two publications of different books that share new names, inserted at once, are both stored" do
    # None of the names is stored yet.
    assert %{first: {:ok, _}, second: {:ok, _}, waited: true} =
             race(
               fn -> Publication.insert(publication_attrs()) end,
               fn -> Publication.insert(publication_attrs(@counselor_ayres)) end
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
               fn -> Publication.insert_all([publication_attrs()]) end,
               fn -> Publication.insert_all([publication_attrs(@counselor_ayres)]) end
             )

    assert count("publications") == [[2]]
    assert count("authors") == [[2]]
    assert count("publishers") == [[1]]
    assert count("countries") == [[1]]
  end

  test "an edit and an insert that add the same new publisher at once both get the one publisher" do
    stored = unboxed(fn -> publication_fixture() end)
    with_knopf = &publication_attrs(Map.put(&1, :publishers, ["Knopf"]))

    assert %{first: {:ok, _}, second: {:ok, _}, waited: true} =
             race(
               fn -> Publication.update(stored.id, with_knopf.(%{})) end,
               fn -> Publication.insert(with_knopf.(@counselor_ayres)) end
             )

    assert count("publishers WHERE name = 'Knopf'") == [[1]]
    assert count("publication_publishers") == [[2]]
  end

  test "two imports that add the same new names in opposite orders at once are both stored" do
    # The two imports name the same translators, the second in the opposite
    # order, and each import inserts all of its new names in one statement.
    translators = for i <- 1..1_000, do: "Translator #{i}"

    rows = fn label, translators ->
      for {translator, i} <- Enum.with_index(translators) do
        publication_attrs(%{
          title: "#{label} #{i}",
          authors: [translator],
          original_title: "#{label} original #{i}",
          original_authors: ["#{label} author #{i}"]
        })
      end
    end

    imports = [rows.("Forward", translators), rows.("Backward", Enum.reverse(translators))]

    results =
      imports
      |> Enum.map(fn batch ->
        Task.async(fn -> unboxed(fn -> Publication.insert_all(batch) end) end)
      end)
      |> Enum.map(&Task.await(&1, 60_000))

    assert [{:ok, _}, {:ok, _}] = results
    assert count("authors") == [[3_000]]
  end
end
