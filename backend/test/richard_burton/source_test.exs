defmodule RichardBurton.SourceTest do
  @moduledoc """
  Tests for the Source schema
  """

  use ExUnit.Case, async: true
  doctest RichardBurton.Source

  alias RichardBurton.Source

  defp changeset(attrs, language \\ "pt") do
    Source.changeset(%Source{}, attrs, language)
  end

  describe "changeset/3" do
    test "when content and position are provided, is valid" do
      assert changeset(%{"content" => "A source", "position" => 0}).valid?
    end

    test "sets the language it is given" do
      assert changeset(%{"content" => "A source", "position" => 0}, "en").changes.language == "en"
    end

    test "when the language is neither pt nor en, is invalid" do
      cs = changeset(%{"content" => "A source", "position" => 0}, "es")

      refute cs.valid?
      assert Keyword.has_key?(cs.errors, :language)
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
      # `validate_required` trims, so the changeset refuses a whitespace-only
      # entry as well as `nest/1` dropping it.
      refute changeset(%{"content" => "   ", "position" => 0}).valid?
    end
  end
end
