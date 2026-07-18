defmodule RichardBurton.ReferenceTest do
  @moduledoc """
  Tests for the Reference schema
  """

  use ExUnit.Case, async: true
  doctest RichardBurton.Reference

  alias RichardBurton.Reference

  defp changeset(attrs) do
    Reference.changeset(%Reference{}, attrs)
  end

  describe "changeset/2" do
    test "when content and position are provided, is valid" do
      assert changeset(%{"content" => "A source", "position" => 0}).valid?
    end

    test "when content is missing, is invalid" do
      cs = changeset(%{"position" => 0})

      refute cs.valid?
      assert Keyword.has_key?(cs.errors, :content)
    end

    test "when content is blank, is invalid" do
      refute changeset(%{"content" => "", "position" => 0}).valid?
    end

    test "when content is whitespace only, is invalid" do
      # `validate_required` trims, so a whitespace-only entry is rejected at the
      # schema level too — not only dropped upstream by `nest/1`.
      refute changeset(%{"content" => "   ", "position" => 0}).valid?
    end
  end
end
