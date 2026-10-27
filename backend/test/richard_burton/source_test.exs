defmodule RichardBurton.SourceTest do
  @moduledoc """
  Tests for the Source schema and its flat shape.
  """

  use ExUnit.Case, async: true
  doctest RichardBurton.Source

  alias RichardBurton.Source

  defp changeset(attrs) do
    Source.changeset(%Source{}, attrs)
  end

  describe "changeset/2" do
    test "when both texts and the position are provided, is valid" do
      assert changeset(%{
               "content_pt" => "Uma fonte",
               "content_en" => "A source",
               "position" => 0
             }).valid?
    end

    test "when only one text is provided, is valid" do
      assert changeset(%{"content_pt" => "Uma fonte", "position" => 0}).valid?
      assert changeset(%{"content_en" => "A source", "position" => 0}).valid?
    end

    test "when both texts are missing, is invalid" do
      cs = changeset(%{"position" => 0})

      refute cs.valid?
      assert Keyword.has_key?(cs.errors, :content_pt)
    end

    test "when both texts are blank or whitespace only, is invalid" do
      refute changeset(%{"content_pt" => "", "content_en" => "   ", "position" => 0}).valid?
    end
  end

  describe "flat?/1" do
    test "holds for a flat source with text in at least one language" do
      assert Source.flat?(%{"pt" => "Uma fonte", "en" => nil})
      assert Source.flat?(%{"pt" => nil, "en" => "A source"})
    end

    test "fails for a source with no text, or with a text that is not a string" do
      refute Source.flat?(%{"pt" => nil, "en" => nil})
      refute Source.flat?(%{"pt" => 1, "en" => nil})
      refute Source.flat?("A source")
    end
  end

  describe "Flat" do
    test "casts strings and maps to flat sources, dropping the ones with no text" do
      assert {:ok, [%{"pt" => "Uma fonte", "en" => nil}, %{"pt" => nil, "en" => "A source"}]} ==
               Source.Flat.cast(["Uma fonte", %{en: "A source"}, %{"pt" => " ", "en" => nil}])
    end

    test "refuses a value that is not a list, and an entry that is not a source" do
      assert {:error, validation: :malformed} == Source.Flat.cast("A source")
      assert {:error, validation: :malformed} == Source.Flat.cast([42])
      assert {:error, validation: :malformed} == Source.Flat.cast([%{"pt" => 42}])
    end

    test "loads the JSON array a jsonb column holds" do
      assert {:ok, [%{"pt" => "Uma fonte", "en" => "A source"}]} ==
               Source.Flat.load([%{"en" => "A source", "pt" => "Uma fonte"}])
    end
  end
end
