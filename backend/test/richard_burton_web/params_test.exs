defmodule RichardBurtonWeb.ParamsTest do
  @moduledoc """
  Tests for `RichardBurtonWeb.Params`: which values each function reads as a
  whole number, and what it returns for the others.
  """
  use ExUnit.Case, async: true

  alias RichardBurtonWeb.Params

  describe "integer/1" do
    test "reads a string of digits and a non-negative integer" do
      assert Params.integer("42") == 42
      assert Params.integer("0") == 0
      assert Params.integer(7) == 7
    end

    test "returns nil for anything that is not a whole number" do
      for value <- ["", "abc", "4x", "1.5", " 3", "-1", -1, 1.5, nil, [], %{}] do
        assert Params.integer(value) == nil, "#{inspect(value)} was read as a number"
      end
    end
  end

  describe "id/1" do
    test "reads a path segment that is a whole number" do
      assert Params.id("12") == {:ok, 12}
    end

    test "is not found for a path segment that is not a whole number" do
      assert Params.id("abc") == {:error, :not_found}
      assert Params.id("-1") == {:error, :not_found}
    end
  end

  describe "integers/1" do
    test "keeps the whole numbers of a list, in order, and leaves out the rest" do
      assert Params.integers(["3", "x", "1", 2, "-4"]) == [3, 1, 2]
    end

    test "returns an empty list for a value that is not a list" do
      assert Params.integers("3") == []
      assert Params.integers(%{"0" => "3"}) == []
      assert Params.integers(nil) == []
    end
  end
end
