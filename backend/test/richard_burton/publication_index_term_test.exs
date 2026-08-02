defmodule RichardBurton.Publication.Index.TermTest do
  @moduledoc """
  Tests for reading a search term as the question it asks.
  """

  use ExUnit.Case, async: true

  alias RichardBurton.Publication.Index.Term

  describe "parse/1 without operators" do
    test "a plain term is one alternative of words" do
      assert [%{words: ["machado", "assis"], filters: []}] = Term.parse("machado assis")
    end

    test "`:or` cuts the term into alternatives" do
      assert [%{words: ["machado"]}, %{words: ["assis"]}] = Term.parse("machado :or assis")
    end

    test "an empty term asks nothing" do
      assert Term.parse("") == []
      assert Term.parse("   ") == []
    end
  end

  describe "parse/1 with a field operator" do
    test "names the field, and keeps the rest as words" do
      assert [%{words: ["1953"], filters: [filter]}] = Term.parse("title:casmurro 1953")

      assert %{field: :title, value: "casmurro", exact: false, negated: false} = filter
    end

    test "a quoted value is taken as written" do
      assert [%{filters: [%{value: "dom casmurro", exact: true}]}] =
               Term.parse(~s(title:"dom casmurro"))
    end

    test "a leading minus excludes" do
      assert [%{filters: [%{field: :countries, value: "GB", negated: true}]}] =
               Term.parse("-country:GB")
    end

    test "several operators narrow together" do
      assert [%{filters: filters}] = Term.parse("title:casmurro year:1953")
      assert Enum.map(filters, & &1.field) == [:title, :year]
    end

    test "operators live inside their own alternative" do
      assert [first, second] = Term.parse("title:casmurro :or title:iracema")
      assert [%{value: "casmurro"}] = first.filters
      assert [%{value: "iracema"}] = second.filters
    end
  end

  describe "parse/1 vocabulary" do
    test "answers to the labels the interface uses" do
      for {name, field} <- [
            {"title", :title},
            {"original", :original_title},
            {"translator", :authors},
            {"original-author", :original_authors},
            {"country", :countries},
            {"publisher", :publishers},
            {"year", :year},
            {"source", :references}
          ] do
        assert [%{filters: [%{field: ^field}]}] = Term.parse("#{name}:x"),
               "expected #{name}: to name #{field}"
      end
    end

    test "answers to the names the database uses" do
      for {name, field} <- [
            {"original_title", :original_title},
            {"authors", :authors},
            {"original_authors", :original_authors},
            {"countries", :countries},
            {"publishers", :publishers},
            {"references", :references}
          ] do
        assert [%{filters: [%{field: ^field}]}] = Term.parse("#{name}:x"),
               "expected #{name}: to name #{field}"
      end
    end

    test "answers in Portuguese" do
      for {name, field} <- [
            {"titulo", :title},
            {"título", :title},
            {"tradutor", :authors},
            {"autor", :original_authors},
            {"pais", :countries},
            {"país", :countries},
            {"editora", :publishers},
            {"ano", :year},
            {"fonte", :references}
          ] do
        assert [%{filters: [%{field: ^field}]}] = Term.parse("#{name}:x"),
               "expected #{name}: to name #{field}"
      end
    end

    test "the name is read whatever its case" do
      assert [%{filters: [%{field: :title}]}] = Term.parse("Title:casmurro")
      assert [%{filters: [%{field: :title}]}] = Term.parse("TÍTULO:casmurro")
    end

    test "a prefix it does not know is not an operator" do
      # A colon in a title is a colon in a title, not a failed query.
      assert [%{words: ["manuel:", "de", "moraes"], filters: []}] =
               Term.parse("manuel: de moraes")

      assert [%{words: ["foo:bar"], filters: []}] = Term.parse("foo:bar")
    end

    test "a name with nothing after it is not an operator" do
      assert [%{words: ["title:"], filters: []}] = Term.parse("title:")
    end
  end

  describe "span/1" do
    test "a single year is that year" do
      assert Term.span("1953") == {1953, 1953}
    end

    test "two years are the span between them" do
      assert Term.span("1950-1960") == {1950, 1960}
    end

    test "an open end runs from, or up to" do
      assert Term.span("1950-") == {1950, nil}
      assert Term.span("-1960") == {nil, 1960}
    end

    test "what is not a span is no span at all" do
      assert Term.span("recent") == :none
      assert Term.span("195x-1960") == :none
      assert Term.span("-") == :none
    end
  end
end
