defmodule RichardBurton.ValidationTest do
  @moduledoc """
  Tests for `Validation.get_errors/1`, which reduces a changeset's errors to the
  codes the API returns.
  """
  use RichardBurton.DataCase, async: true

  alias RichardBurton.Author
  alias RichardBurton.Country
  alias RichardBurton.Validation

  describe "get_errors/1" do
    test "returns :required for a missing required field" do
      assert Validation.get_errors(Author.changeset(%Author{}, %{})) == %{name: :required}
    end

    test "collapses a single unique-constraint violation to :conflict" do
      %Author{} |> Author.changeset(%{name: "Clarice Lispector"}) |> Repo.insert!()

      {:error, changeset} =
        %Author{} |> Author.changeset(%{name: "Clarice Lispector"}) |> Repo.insert()

      assert Validation.get_errors(changeset) == :conflict
    end

    test "returns :alpha2 for an invalid ISO country code" do
      assert Validation.get_errors(Country.changeset(%Country{}, %{code: "ZZ"})) ==
               %{code: :alpha2}
    end
  end
end
