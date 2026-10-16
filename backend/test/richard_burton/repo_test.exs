defmodule RichardBurton.RepoTest do
  @moduledoc """
  Tests for the helpers `RichardBurton.Repo` adds to the Ecto repository.
  """

  use RichardBurton.DataCase

  alias RichardBurton.Author

  describe "insert_in_chunks/3" do
    test "puts as many entries in a statement as 65,535 parameters allow, and returns the rows in order" do
      # An author row has three columns: its name and two timestamps.
      per_statement = div(65_535, 3)
      names = for i <- 1..(per_statement + 1), do: "Author #{i}"

      {returned, statements} =
        count_queries(fn ->
          Repo.insert_in_chunks(Author, Enum.map(names, &%{name: &1}), returning: [:name])
        end)

      assert Enum.map(returned, & &1.name) == names
      assert statements == 2
    end

    test "sizes the statements by the entry with the most keys, and gives a missing key its column's default" do
      # The first row has three columns, its name and two timestamps, and every
      # other row has four, with its id. The rows need more than 65,535
      # parameters in all, so they take two statements.
      per_statement = div(65_535, 4)
      first = %{name: "Author 0"}
      others = for i <- 1..(per_statement + 1), do: %{id: 1_000_000 + i, name: "Author #{i}"}

      {returned, statements} =
        count_queries(fn ->
          Repo.insert_in_chunks(Author, [first | others], returning: [:id, :name])
        end)

      assert Enum.map(returned, & &1.name) == Enum.map([first | others], & &1.name)
      assert statements == 2

      [generated | given] = returned
      assert generated.id < 1_000_000
      assert Enum.map(given, & &1.id) == Enum.map(others, & &1.id)
    end

    test "gives each entry of a schema the timestamps the schema generates" do
      [author] = Repo.insert_in_chunks(Author, [%{name: "Author"}], returning: true)

      assert %NaiveDateTime{} = author.inserted_at
      assert author.updated_at == author.inserted_at
    end

    test "returns an empty list without :returning" do
      assert [] == Repo.insert_in_chunks(Author, [%{name: "Author"}])
    end

    test "sends no statement for no entries" do
      assert {[], 0} ==
               count_queries(fn -> Repo.insert_in_chunks(Author, [], returning: [:id]) end)
    end
  end
end
