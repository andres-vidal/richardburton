defmodule RichardBurton.ValidationTest do
  @moduledoc """
  Tests for `Validation.get_errors/1`, which reduces a changeset's errors to the
  codes the API returns.
  """
  use RichardBurton.DataCase, async: true

  alias RichardBurton.Author
  alias RichardBurton.Country
  alias RichardBurton.Document
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

    test "returns the type a value could not be cast to" do
      changeset = Ecto.Changeset.cast(%Document{}, %{"rows" => "many"}, [:rows])

      assert Validation.get_errors(changeset) == %{rows: :integer}
    end

    test "returns :invalid for any other failed validation" do
      changeset =
        %Author{}
        |> Ecto.Changeset.cast(%{"name" => "Isabel Burton"}, [:name])
        |> Ecto.Changeset.validate_length(:name, max: 5)
        |> Ecto.Changeset.validate_inclusion(:name, ["Richard Burton"])

      assert Validation.get_errors(changeset) == %{name: :invalid}
    end
  end
end
