defmodule RichardBurton.RichTextTest do
  @moduledoc """
  Tests for the RichText type: the shape it casts, how it measures text, and
  its conversions to and from plain text.
  """

  use ExUnit.Case, async: true
  doctest RichardBurton.RichText

  alias RichardBurton.RichText

  # Returns a run of `text` with the marks in `marks`.
  defp run(text, marks \\ %{}), do: Map.merge(%{"text" => text}, marks)

  # Returns a paragraph of `inlines`, or of one run when given a string.
  defp paragraph(text) when is_binary(text), do: paragraph([run(text)])
  defp paragraph(inlines), do: %{"type" => "paragraph", "children" => inlines}

  # Returns a list item of `kind` at `depth`, holding one run of `text`.
  defp item(kind, depth, text) do
    %{"type" => "list-item", "list" => kind, "depth" => depth, "children" => [run(text)]}
  end

  # Returns a link to `url` showing one run of `text`.
  defp link(url, text), do: %{"type" => "link", "url" => url, "children" => [run(text)]}

  # Returns whether `value` fails to cast as malformed.
  defp malformed?(value), do: RichText.cast(value) == {:error, validation: :malformed}

  describe "cast/1" do
    test "accepts paragraphs, list items of both kinds at every depth, marks and links" do
      value = [
        paragraph([
          run("Plain, "),
          run("bold, ", %{"bold" => true}),
          run("italic, ", %{"italic" => false}),
          run("both", %{"bold" => true, "italic" => true}),
          run(" and a line\nbreak, with "),
          link("https://example.com/a?b=c#d", "a link"),
          run("")
        ]),
        item("bulleted", 0, "A bullet"),
        item("bulleted", 1, "A deeper bullet"),
        item("numbered", 2, "A number at the deepest level"),
        item("numbered", 0, "A number"),
        paragraph([
          link("http://example.com", "Plain HTTP"),
          link("HTTPS://EXAMPLE.COM", "Upper case"),
          link("mailto:isabel@example.com", "An address")
        ])
      ]

      assert RichText.cast(value) == {:ok, value}
    end

    test "turns atom keys into strings" do
      value = [
        %{type: "paragraph", children: [%{text: "A note", bold: true}]},
        %{
          type: "list-item",
          list: "numbered",
          depth: 0,
          children: [%{type: "link", url: "https://example.com", children: [%{text: "A link"}]}]
        }
      ]

      assert RichText.cast(value) ==
               {:ok,
                [
                  paragraph([run("A note", %{"bold" => true})]),
                  %{
                    "type" => "list-item",
                    "list" => "numbered",
                    "depth" => 0,
                    "children" => [link("https://example.com", "A link")]
                  }
                ]}
    end

    test "returns nil for an empty list and for a value with nothing but whitespace" do
      assert RichText.cast([]) == {:ok, nil}
      assert RichText.cast([paragraph("")]) == {:ok, nil}

      assert RichText.cast([
               paragraph(" \n "),
               item("bulleted", 0, "\t"),
               paragraph([link("https://example.com", " ")])
             ]) == {:ok, nil}
    end

    test "refuses a value that is not a list of blocks" do
      assert malformed?("A note written as **Markdown**")
      assert malformed?(%{"type" => "paragraph", "children" => [run("A note")]})
      assert malformed?(42)
      assert malformed?(["A note"])
      assert malformed?([nil])
      assert malformed?([run("A run is not a block")])
      assert malformed?([link("https://example.com", "A link is not a block")])
    end

    test "refuses a node of an unknown type" do
      assert malformed?([%{"type" => "heading", "children" => [run("A title")]}])
      assert malformed?([paragraph([%{"type" => "image", "url" => "https://example.com/a.png"}])])
    end

    test "refuses a node with a key it does not have" do
      assert malformed?([Map.put(paragraph("A note"), "align", "center")])
      assert malformed?([Map.put(item("bulleted", 0, "An item"), "checked", true)])
      assert malformed?([paragraph([run("A note", %{"underline" => true})])])
      assert malformed?([paragraph([run("A note", %{"type" => "text"})])])

      assert malformed?([
               paragraph([Map.put(link("https://example.com", "A link"), "title", "A title")])
             ])
    end

    test "refuses a node without the keys it needs" do
      assert malformed?([%{"type" => "paragraph"}])
      assert malformed?([%{"children" => [run("A note")]}])
      assert malformed?([Map.delete(item("bulleted", 0, "An item"), "list")])
      assert malformed?([Map.delete(item("bulleted", 0, "An item"), "depth")])
      assert malformed?([paragraph([%{"bold" => true}])])
      assert malformed?([paragraph([Map.delete(link("https://example.com", "A"), "url")])])
    end

    test "refuses empty or missing children" do
      assert malformed?([paragraph([])])
      assert malformed?([%{item("numbered", 0, "An item") | "children" => []}])
      assert malformed?([paragraph([%{link("https://example.com", "A") | "children" => []}])])
      assert malformed?([%{paragraph("A note") | "children" => "A note"}])
    end

    test "refuses a list of an unknown kind" do
      assert malformed?([item("checked", 0, "An item")])
    end

    test "refuses a depth out of range, or one that is not a whole number" do
      assert malformed?([item("bulleted", 3, "Too deep")])
      assert malformed?([item("bulleted", -1, "Not deep enough")])
      assert malformed?([item("bulleted", "1", "A string")])
      assert malformed?([item("bulleted", 1.0, "A float")])
    end

    test "refuses a run whose text is not a string, or whose marks are not booleans" do
      assert malformed?([paragraph([%{"text" => nil}])])
      assert malformed?([paragraph([%{"text" => 1}])])
      assert malformed?([paragraph([run("A note", %{"bold" => "true"})])])
      assert malformed?([paragraph([run("A note", %{"italic" => nil})])])
    end

    test "refuses a link to anything but an http, https or mailto URL" do
      for url <- [
            "javascript:alert(1)",
            "data:text/html,<script>alert(1)</script>",
            "ftp://example.com",
            "//example.com",
            "/a/path",
            "example.com",
            "https://",
            "mailto:",
            "https://exa mple.com",
            " https://example.com",
            "https://example.com\n"
          ] do
        assert malformed?([paragraph([link(url, "A link")])]), "#{inspect(url)} was accepted"
      end

      assert malformed?([paragraph([%{link("https://example.com", "A") | "url" => nil}])])
    end

    test "refuses a link inside a link, and a block inside a block" do
      inner = link("https://example.com/inner", "Inner")
      outer = %{"type" => "link", "url" => "https://example.com", "children" => [inner]}

      assert malformed?([paragraph([outer])])
      assert malformed?([paragraph([paragraph("Nested")])])
      assert malformed?([%{item("bulleted", 0, "") | "children" => [item("bulleted", 1, "A")]}])
    end

    test "refuses a value of more than 10,000 nodes, counting blocks, links and runs" do
      at_most = [paragraph(List.duplicate(run("a"), 9_999))]
      too_many = [paragraph(List.duplicate(run("a"), 10_000))]

      assert {:ok, _} = RichText.cast(at_most)
      assert malformed?(too_many)

      # One paragraph, 3,333 runs, and 3,333 links of one run each.
      runs = List.duplicate(run("a"), 3_333)
      links = List.duplicate(link("https://example.com", "a"), 3_333)
      assert {:ok, _} = RichText.cast([paragraph(runs ++ links)])
      assert malformed?([paragraph([run("b") | runs ++ links])])
    end
  end

  describe "blank?/1" do
    test "is true for nil and for whitespace, and false for any text" do
      assert RichText.blank?(nil)
      assert RichText.blank?([paragraph(" "), item("numbered", 0, "\n")])
      refute RichText.blank?([paragraph(" "), item("numbered", 0, "a")])
    end
  end

  describe "text_length/1" do
    test "counts the graphemes of every run, line breaks included, and 0 for nil" do
      value = [
        paragraph([run("Ab"), run("c\n", %{"bold" => true})]),
        item("bulleted", 1, "é"),
        paragraph([link("https://example.com", "link")])
      ]

      assert RichText.text_length(value) == 9
      assert RichText.text_length(nil) == 0
    end
  end

  describe "to_plain_text/1" do
    test "is empty for nil" do
      assert RichText.to_plain_text(nil) == ""
    end

    test "separates paragraphs with a blank line, keeps line breaks and drops marks" do
      value = [
        paragraph([run("  First "), run("edition", %{"bold" => true}), run(",  \nin English. ")]),
        paragraph([run("Bound in "), run("green", %{"italic" => true}), run(" cloth.")])
      ]

      assert RichText.to_plain_text(value) ==
               "First edition,\nin English.\n\nBound in green cloth."
    end

    test "writes nested bulleted items indented by two spaces a level" do
      value = [
        item("bulleted", 0, "One"),
        item("bulleted", 1, "One a"),
        item("bulleted", 2, "One a i"),
        item("bulleted", 0, "Two")
      ]

      assert RichText.to_plain_text(value) == "- One\n  - One a\n    - One a i\n- Two"
    end

    test "numbers each numbered list, counting its items at its own depth" do
      value = [
        item("numbered", 0, "One"),
        item("numbered", 1, "One a"),
        item("numbered", 1, "One b"),
        item("numbered", 2, "One b i"),
        item("numbered", 0, "Two"),
        item("numbered", 1, "Two a")
      ]

      assert RichText.to_plain_text(value) ==
               "1. One\n  1. One a\n  2. One b\n    1. One b i\n2. Two\n  1. Two a"
    end

    test "restarts the numbering after another block, or after an item of the other kind" do
      value = [
        item("numbered", 0, "a"),
        item("numbered", 0, "b"),
        item("bulleted", 0, "c"),
        item("numbered", 0, "d"),
        paragraph("A paragraph."),
        item("numbered", 0, "e")
      ]

      assert RichText.to_plain_text(value) ==
               "1. a\n2. b\n- c\n1. d\n\nA paragraph.\n\n1. e"
    end

    test "keeps counting a list across the deeper items inside it" do
      value = [
        item("numbered", 0, "a"),
        item("bulleted", 1, "inside a"),
        item("numbered", 0, "b")
      ]

      assert RichText.to_plain_text(value) == "1. a\n  - inside a\n2. b"
    end

    test "lines up the lines after a line break in an item with the item's text" do
      value = [
        item("numbered", 0, "First line\nsecond line"),
        item("bulleted", 1, "First line\nsecond line")
        | for(n <- 2..10, do: item("numbered", 0, "Item #{n}"))
      ]

      value = List.update_at(value, -1, &%{&1 | "children" => [run("Ten\nmore")]})

      assert RichText.to_plain_text(value) ==
               """
               1. First line
                  second line
                 - First line
                   second line
               2. Item 2
               3. Item 3
               4. Item 4
               5. Item 5
               6. Item 6
               7. Item 7
               8. Item 8
               9. Item 9
               10. Ten
                   more\
               """
    end

    test "writes the first item of a run at depth 0, and each item at most one level deeper than the one before" do
      value = [
        item("bulleted", 1, "a"),
        item("bulleted", 2, "b"),
        item("numbered", 0, "c"),
        item("numbered", 2, "d"),
        item("numbered", 1, "e"),
        item("numbered", 2, "f")
      ]

      assert RichText.to_plain_text(value) ==
               "- a\n  - b\n1. c\n  1. d\n  2. e\n    1. f"
    end

    test "leaves blank blocks out, and does not count a blank item" do
      value = [
        paragraph(" "),
        item("numbered", 0, "a"),
        item("numbered", 0, " "),
        item("numbered", 0, "b"),
        paragraph(""),
        item("numbered", 0, "c")
      ]

      assert RichText.to_plain_text(value) == "1. a\n2. b\n\n1. c"
    end

    test "writes a link as its text and its URL, or its text alone when that is the URL" do
      value = [
        paragraph([
          run("See "),
          link("https://example.com/catalogue", "the catalogue"),
          run(", "),
          link("https://example.com", "https://example.com"),
          run(", "),
          link("mailto:isabel@example.com", "isabel@example.com"),
          run(", "),
          link("MAILTO:richard@example.com", "richard@example.com"),
          run(", "),
          link("mailto:office@example.com", "the office"),
          run(" and "),
          link("https://example.com/blank", "")
        ])
      ]

      assert RichText.to_plain_text(value) ==
               "See the catalogue (https://example.com/catalogue), https://example.com, " <>
                 "isabel@example.com, richard@example.com, " <>
                 "the office (mailto:office@example.com) and https://example.com/blank"
    end
  end

  describe "from_plain_text/1" do
    test "is nil for nil, an empty string and whitespace" do
      assert RichText.from_plain_text(nil) == nil
      assert RichText.from_plain_text("") == nil
      assert RichText.from_plain_text(" \n\t\r\n ") == nil
    end

    test "starts a paragraph at one or more blank lines, and keeps a single line break" do
      text = "First edition,\nin English.\n\nBound in cloth.\n \n\t\n\nSigned."

      assert RichText.from_plain_text(text) ==
               [
                 paragraph("First edition,\nin English."),
                 paragraph("Bound in cloth."),
                 paragraph("Signed.")
               ]
    end

    test "reads CRLF and CR line endings as LF" do
      assert RichText.from_plain_text("One,\r\ntwo.\r\n\r\nThree,\rfour.") ==
               [paragraph("One,\ntwo."), paragraph("Three,\nfour.")]
    end

    test "trims each paragraph and the end of each line, and keeps the indentation of a later line" do
      assert RichText.from_plain_text("  1. One   \n  2. Two \n\n   A paragraph.  ") ==
               [paragraph("1. One\n  2. Two"), paragraph("A paragraph.")]
    end

    test "reads no formatting" do
      text = "**Bold** and [a link](https://example.com)\n- not a list"

      assert RichText.from_plain_text(text) == [paragraph(text)]
    end

    test "returns rich text that casts to itself" do
      value = RichText.from_plain_text("One.\n\nTwo,\nthree.")

      assert RichText.cast(value) == {:ok, value}
    end

    test "reads back plain text as to_plain_text writes it, which writes it again the same" do
      value = [
        paragraph([run("Signed "), link("https://example.com", "by her")]),
        item("numbered", 0, "One\nmore"),
        item("bulleted", 1, "One a")
      ]

      written = RichText.to_plain_text(value)
      read = RichText.from_plain_text(written)

      assert read == [
               paragraph("Signed by her (https://example.com)"),
               paragraph("1. One\n   more\n  - One a")
             ]

      assert RichText.to_plain_text(read) == written
    end
  end
end
