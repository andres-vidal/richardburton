defmodule RichardBurton.Publication.Index.TermTest do
  @moduledoc """
  Tests for parsing a search term into alternatives and field filters.
  """

  use ExUnit.Case, async: true

  alias RichardBurton.Publication.Index.Term

  doctest RichardBurton.Publication.Index.Term

  describe "parse/1 without operators" do
    test "a plain term is one alternative of words" do
      assert [%{words: ["machado", "assis"], filters: []}] = Term.parse("machado assis")
    end

    test "`:or` splits the term into alternatives" do
      assert [%{words: ["machado"]}, %{words: ["assis"]}] = Term.parse("machado :or assis")
    end

    test "an empty term parses to no alternatives" do
      assert Term.parse("") == []
      assert Term.parse("   ") == []
    end
  end

  describe "parse/1 with a field operator" do
    test "an operator names its field and the rest stays free words" do
      assert [%{words: ["1953"], filters: [filter]}] = Term.parse("title:casmurro 1953")

      assert %{field: :title, value: "casmurro", exact: false, negated: false} = filter
    end

    test "a quoted value is marked exact" do
      assert [%{filters: [%{value: "dom casmurro", exact: true}]}] =
               Term.parse(~s(title:"dom casmurro"))
    end

    test "a leading minus excludes" do
      assert [%{filters: [%{field: :countries, value: "GB", negated: true}]}] =
               Term.parse("-country:GB")
    end

    test "several operators are kept as separate filters" do
      assert [%{filters: filters}] = Term.parse("title:casmurro year:1953")
      assert Enum.map(filters, & &1.field) == [:title, :year]
    end

    test "an operator belongs to its own alternative" do
      assert [first, second] = Term.parse("title:casmurro :or title:iracema")
      assert [%{value: "casmurro"}] = first.filters
      assert [%{value: "iracema"}] = second.filters
    end
  end

  describe "parse/1 vocabulary" do
    test "accepts the labels the interface uses" do
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

    test "a repeated operator parses as two filters, and plurals are not names" do
      # `author:machado author:assis` wants both; a plural spelling would only
      # be a second way to say the same thing.
      assert [%{words: ["authors:machado"], filters: []}] = Term.parse("authors:machado")
      assert [%{filters: [_, _]}] = Term.parse("author:machado author:assis")
    end

    test "accepts Portuguese names" do
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

    test "operator names are case-insensitive" do
      assert [%{filters: [%{field: :title}]}] = Term.parse("Title:casmurro")
      assert [%{filters: [%{field: :title}]}] = Term.parse("TÍTULO:casmurro")
    end

    test "author maps to original_authors and translator to authors" do
      # The column named `authors` holds the translators; that is the database's
      # word, and a reader asking for an author means the writer.
      assert [%{filters: [%{field: :original_authors}]}] = Term.parse("author:machado")
      assert [%{filters: [%{field: :original_authors}]}] = Term.parse("autor:machado")
      assert [%{filters: [%{field: :authors}]}] = Term.parse("translator:caldwell")
    end

    test "an unterminated delimiter is not an operator" do
      # The tokenizer splits on the space, so `title:"dom` is a prefix with no
      # closing quote and parses as free text rather than half a phrase.
      assert [%{words: ["title:", "dom", "casmurro"], filters: []}] =
               Term.parse(~s(title:"dom casmurro))

      assert [%{words: ["title:", "dom"], filters: []}] = Term.parse("title:(dom")
    end

    test "a bracketed value keeps several words for one field" do
      assert [%{filters: [filter]}] = Term.parse("title:(dom casmurro)")
      assert %{field: :title, value: "dom casmurro", exact: false} = filter
    end

    test "an unrecognised prefix is parsed as free text" do
      # A colon in a title is a colon in a title, not a failed query.
      assert [%{words: ["manuel:", "de", "moraes"], filters: []}] =
               Term.parse("manuel: de moraes")

      assert [%{words: ["foo:bar"], filters: []}] = Term.parse("foo:bar")
    end

    test "an operator with an empty value is parsed as free text" do
      assert [%{words: ["title:"], filters: []}] = Term.parse("title:")
    end
  end

  describe "span/1" do
    test "a single year parses to that year on both bounds" do
      assert Term.span("1953") == {1953, 1953}
    end

    test "two years parse to a closed range" do
      assert Term.span("1950-1960") == {1950, 1960}
    end

    test "an omitted bound parses to nil" do
      assert Term.span("1950-") == {1950, nil}
      assert Term.span("-1960") == {nil, 1960}
    end

    test "an unparseable value returns :none" do
      assert Term.span("recent") == :none
      assert Term.span("195x-1960") == :none
      assert Term.span("-") == :none
    end
  end
end
