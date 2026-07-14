defmodule RichardBurton.ValidationTest do
  @moduledoc """
  `Validation.validate/2` runs a changeset through a rolled-back insert so it can
  surface constraint errors (e.g. uniqueness) without persisting anything, then
  maps the changeset errors to the compact atom codes the API returns.
  """
  use RichardBurton.DataCase, async: true

  alias RichardBurton.Validation
  alias RichardBurton.Author
  alias RichardBurton.Country
  alias RichardBurton.Repo

  describe "validate/2" do
    test "returns :ok when the changeset would insert cleanly" do
      changeset = Author.changeset(%Author{}, %{name: "Machado de Assis"})

      assert Validation.validate(changeset, &Function.identity/1) == :ok
    end

    test "rolls back the probe insert, persisting nothing" do
      changeset = Author.changeset(%Author{}, %{name: "Machado de Assis"})

      assert Validation.validate(changeset, &Function.identity/1) == :ok
      assert Repo.all(Author) == []
    end

    test "returns :required for a missing required field" do
      changeset = Author.changeset(%Author{}, %{})

      assert Validation.validate(changeset, &Function.identity/1) == {:error, %{name: :required}}
    end

    test "collapses a single unique-constraint violation to :conflict" do
      %Author{} |> Author.changeset(%{name: "Clarice Lispector"}) |> Repo.insert!()
      changeset = Author.changeset(%Author{}, %{name: "Clarice Lispector"})

      assert Validation.validate(changeset, &Function.identity/1) == {:error, :conflict}
    end

    test "returns :alpha2 for an invalid ISO country code" do
      changeset = Country.changeset(%Country{}, %{code: "ZZ"})

      assert Validation.validate(changeset, &Function.identity/1) == {:error, %{code: :alpha2}}
    end
  end
end
