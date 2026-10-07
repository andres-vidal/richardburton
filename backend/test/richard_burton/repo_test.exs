defmodule RichardBurton.RepoTest do
  @moduledoc """
  Tests for the helpers `RichardBurton.Repo` adds to the Ecto repository.
  """

  use RichardBurton.DataCase

  alias RichardBurton.Author

  describe "insert_in_chunks/3" do
    test "inserts 5,000 entries per statement and returns the rows in the order of the entries" do
      now = NaiveDateTime.utc_now(:second)
      names = for i <- 1..5_001, do: "Author #{i}"
      entries = Enum.map(names, &%{name: &1, inserted_at: now, updated_at: now})

      {returned, statements} =
        count_queries(fn -> Repo.insert_in_chunks(Author, entries, returning: [:name]) end)

      assert Enum.map(returned, & &1.name) == names
      assert statements == 2
      assert Repo.aggregate(Author, :count) == 5_001
    end

    test "returns an empty list without :returning" do
      now = NaiveDateTime.utc_now(:second)

      assert [] ==
               Repo.insert_in_chunks(Author, [
                 %{name: "Author", inserted_at: now, updated_at: now}
               ])
    end

    test "sends no statement for no entries" do
      assert {[], 0} ==
               count_queries(fn -> Repo.insert_in_chunks(Author, [], returning: [:id]) end)
    end
  end
end
