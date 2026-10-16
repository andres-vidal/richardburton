defmodule RichardBurton.RichText do
  @moduledoc ~S"""
  An Ecto type for rich text stored in a `jsonb` column, and functions that
  measure rich text and convert it to and from plain text.

  These terms describe rich text. The keys of every node are strings.

    * **value** — a non-empty list of blocks, in reading order, or nil when
      there is no text.
    * **block** — a paragraph or a list item. A paragraph is
      `%{"type" => "paragraph", "children" => inlines}`. A list item is
      `%{"type" => "list-item", "list" => kind, "depth" => depth, "children" => inlines}`.
    * **kind** — the kind of list an item belongs to, `"bulleted"` or
      `"numbered"`.
    * **depth** — how deep a list item is, from 0 for an item of a top-level
      list to 2. Lists are not nested in the value: a nested list is a run of
      items one level deeper than the item before them.
    * **inline** — a run or a link.
    * **run** — a run of text, `%{"text" => text}`, with `"bold"` and
      `"italic"` as optional booleans. A `"\n"` in the text is a line break.
    * **link** — `%{"type" => "link", "url" => url, "children" => runs}`. The
      URL starts with `http://`, `https://` or `mailto:`, in any case, has
      something after that, and holds no whitespace.

  Every list of children holds at least one node, and a node holds no keys
  other than the ones listed for it. A value or a block is **blank** when the
  text of its runs, the runs of its links included, is empty or only
  whitespace.

  A value is **normalized** when none of its lists skips a level. The first
  list item that is not blank after the start of the value, or after a block
  that is not a list item, blank or not, is at depth 0. Every other list item
  that is not blank is at most one level deeper than the last list item before
  it that is not blank. A blank list item may be at any depth.

  Casting a value checks the shape these terms describe, and returns nil for a
  blank value or an empty list. Any other value is returned normalized.
  Casting goes through the list items that are not blank in order, and lowers
  each one that is too deep to the deepest depth a normalized value allows.
  Blank blocks are kept as they are. A value of any other shape, such as one
  whose nodes have atom keys, or one with more than 10,000 nodes, fails to
  cast with the validation `:malformed`.

  A **bare URL** is a word of plain text that `from_plain_text/1` reads as a
  link: a web address or an email address, as that function describes.
  """

  use Ecto.Type

  @typedoc "A list of blocks, as the module doc describes them."
  @type t :: [map()]

  # The most nodes a value may hold: its blocks, links and runs together.
  @max_nodes 10_000

  # The kinds of list, the depths of a list item and the marks of a run.
  @kinds ["bulleted", "numbered"]
  @depths 0..2
  @marks ["bold", "italic"]

  # A URL a link may go to.
  @safe_url ~r/\A(https?:\/\/|mailto:)\S+\z/iu

  @impl true
  def type, do: {:array, :map}

  @impl true
  def cast(blocks) when is_list(blocks) do
    cond do
      not Enum.all?(blocks, &block?/1) -> {:error, validation: :malformed}
      node_count(blocks) > @max_nodes -> {:error, validation: :malformed}
      blank?(blocks) -> {:ok, nil}
      true -> {:ok, normalized(blocks)}
    end
  end

  def cast(_value), do: {:error, validation: :malformed}

  @impl true
  def load(blocks) when is_list(blocks), do: {:ok, blocks}
  def load(_value), do: :error

  @impl true
  def dump(blocks) when is_list(blocks), do: {:ok, blocks}
  def dump(_value), do: :error

  # Returns whether `node` is a well-formed block.
  defp block?(block = %{"type" => "paragraph", "children" => children})
       when map_size(block) == 2,
       do: inlines?(children)

  defp block?(
         block = %{
           "type" => "list-item",
           "list" => kind,
           "depth" => depth,
           "children" => children
         }
       )
       when map_size(block) == 4 and kind in @kinds and depth in @depths,
       do: inlines?(children)

  defp block?(_node), do: false

  # Returns whether `children` is a non-empty list of well-formed inlines.
  defp inlines?(children = [_ | _]), do: Enum.all?(children, &inline?/1)
  defp inlines?(_children), do: false

  # Returns whether `node` is a well-formed link or run.
  defp inline?(link = %{"type" => "link", "url" => url, "children" => children})
       when map_size(link) == 3 and is_binary(url),
       do: Regex.match?(@safe_url, url) and runs?(children)

  defp inline?(node), do: run?(node)

  # Returns whether `children` is a non-empty list of well-formed runs.
  defp runs?(children = [_ | _]), do: Enum.all?(children, &run?/1)
  defp runs?(_children), do: false

  # Returns whether `node` is a well-formed run: a text, and marks that are
  # booleans.
  defp run?(run = %{"text" => text}) when is_binary(text) do
    run
    |> Map.delete("text")
    |> Enum.all?(fn {mark, on} -> mark in @marks and is_boolean(on) end)
  end

  defp run?(_node), do: false

  # Returns the number of nodes in a list of well-formed nodes, counting the
  # nodes inside each one.
  defp node_count(nodes) do
    Enum.reduce(nodes, 0, fn
      %{"children" => children}, count -> count + 1 + node_count(children)
      _run, count -> count + 1
    end)
  end

  # Returns well-formed `blocks` normalized, as the module doc describes. The
  # depth of each list item that is not blank is lowered to at most one more
  # than the depth of the last list item before it that is not blank. When
  # there is no such item, or a block that is not a list item comes after it,
  # the limit is depth 0. Blank list items and every other block are returned
  # unchanged.
  defp normalized(blocks) do
    {normalized, _before} =
      Enum.map_reduce(blocks, -1, fn
        item = %{"type" => "list-item", "depth" => depth}, before ->
          if blank?([item]) do
            {item, before}
          else
            depth = min(depth, before + 1)
            {%{item | "depth" => depth}, depth}
          end

        block, _before ->
          {block, -1}
      end)

    normalized
  end

  @doc """
  Returns whether `value` is nil, or holds no text other than whitespace.
  """
  @spec blank?(t() | nil) :: boolean()
  def blank?(nil), do: true
  def blank?(value), do: value |> text() |> String.trim() == ""

  @doc """
  Returns the number of characters in the text of `value`'s runs, line breaks
  included, or 0 for nil. A character is a grapheme, as `String.length/1`
  counts them.
  """
  @spec text_length(t() | nil) :: non_neg_integer()
  def text_length(nil), do: 0
  def text_length(value), do: value |> text() |> String.length()

  # Returns the text of every run in a list of nodes, in order, as one string.
  defp text(nodes), do: nodes |> Enum.map(&node_text/1) |> IO.iodata_to_binary()

  # Returns the text of a node's runs as iodata.
  defp node_text(%{"children" => children}), do: Enum.map(children, &node_text/1)
  defp node_text(%{"text" => text}), do: text

  @doc ~S"""
  Returns `value` as plain text, or an empty string for nil.

  The blocks are written in order. Consecutive list items are on consecutive
  lines, and every other pair of blocks is separated by a blank line. Blank
  blocks are left out. A line break in a block starts a new line, and the
  whitespace at the ends of each line is dropped, except the indentation of a
  line after a line break.

  A list item is written after `- ` when it is bulleted, and after `N. ` when
  it is numbered, indented by two spaces for each level of its depth. The
  lines after a line break in a list item are indented to line up with the
  item's text. Each item is written at the depth it holds, so `value` must be
  normalized, as every value that `cast/1` returns is.

  A numbered item's `N` is its place in its list. A list ends at any block
  other than a list item, blank or not, at an item less deep than its own
  items, and at an item of the other kind at the same depth. Items deeper
  than the list's own do not end it, and a blank item is not counted.

  Bold and italic are dropped. A link is written as its text followed by its
  URL in parentheses, or as its text alone when the text is the URL, without
  `mailto:` for an email address. A link without text is written as its URL.

  ## Examples

      iex> RichardBurton.RichText.to_plain_text([
      ...>   %{"type" => "paragraph", "children" => [%{"text" => "Signed by"}]},
      ...>   %{"type" => "list-item", "list" => "numbered", "depth" => 0,
      ...>     "children" => [%{"text" => "Isabel Burton"}]},
      ...>   %{"type" => "list-item", "list" => "bulleted", "depth" => 1,
      ...>     "children" => [%{"text" => "on the title page,\nin ink"}]},
      ...>   %{"type" => "list-item", "list" => "numbered", "depth" => 0,
      ...>     "children" => [%{"text" => "Richard Burton"}]}
      ...> ])
      "Signed by\n\n1. Isabel Burton\n  - on the title page,\n    in ink\n2. Richard Burton"

      iex> RichardBurton.RichText.to_plain_text([
      ...>   %{"type" => "paragraph", "children" => [
      ...>     %{"text" => "See "},
      ...>     %{"type" => "link", "url" => "https://example.com", "children" => [%{"text" => "the catalogue"}]},
      ...>     %{"text" => " or "},
      ...>     %{"type" => "link", "url" => "mailto:a@b.com", "children" => [%{"text" => "a@b.com"}]}
      ...>   ]}
      ...> ])
      "See the catalogue (https://example.com) or a@b.com"
  """
  @spec to_plain_text(t() | nil) :: String.t()
  def to_plain_text(nil), do: ""

  def to_plain_text(value) do
    value
    |> Enum.chunk_by(&(&1["type"] == "list-item"))
    |> Enum.flat_map(&sections/1)
    |> Enum.map(&written_section/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.join("\n\n")
  end

  # Returns the sections a chunk of blocks is written in: one section for a
  # run of list items, and one for each paragraph.
  defp sections(chunk = [%{"type" => "list-item"} | _]), do: [chunk]
  defp sections(paragraphs), do: Enum.map(paragraphs, &[&1])

  # Returns a section as plain text: its blocks that are not blank, one after
  # another, each starting on a new line.
  defp written_section(blocks) do
    blocks
    |> Enum.reject(&blank?([&1]))
    |> numbered()
    |> Enum.map_join("\n", &written_block/1)
  end

  # Returns the lines of a block's inlines as plain text: the text split at
  # each line break, with the whitespace at the ends of the text and at the
  # end of each line dropped.
  defp plain_lines(inlines) do
    inlines
    |> Enum.map_join(&plain_inline/1)
    |> String.trim()
    |> String.split("\n")
    |> Enum.map(&String.trim_trailing/1)
  end

  # Returns an inline as plain text, as `to_plain_text/1` describes.
  defp plain_inline(%{"type" => "link", "url" => url, "children" => runs}) do
    text = Enum.map_join(runs, & &1["text"])
    label = String.replace(url, ~r/\Amailto:/i, "")

    cond do
      String.trim(text) == "" -> label
      text == label -> text
      true -> "#{text} (#{url})"
    end
  end

  defp plain_inline(%{"text" => text}), do: text

  # Returns each of `blocks` paired with its number: a numbered item's place
  # in its list, and nil for any other block.
  #
  # The lists open at the current block are kept as a stack of
  # `{depth, kind, count}`, the deepest first. An item closes the lists deeper
  # than itself, continues the list at its own depth when it is of the same
  # kind, and opens a new list otherwise. Any other block closes them all.
  defp numbered(blocks) do
    {numbered, _open} =
      Enum.map_reduce(blocks, [], fn
        item = %{"type" => "list-item", "depth" => depth, "list" => kind}, open ->
          {count, open} = counted(Enum.drop_while(open, &(elem(&1, 0) > depth)), depth, kind)
          {{item, if(kind == "numbered", do: count)}, open}

        block, _open ->
          {{block, nil}, []}
      end)

    numbered
  end

  # Returns the count of an item of `kind` at `depth` in its list, and the
  # stack of open lists with that list on top. `open` holds no list deeper
  # than `depth`.
  defp counted([{depth, kind, count} | rest], depth, kind),
    do: {count + 1, [{depth, kind, count + 1} | rest]}

  defp counted([{depth, _other, _count} | rest], depth, kind), do: {1, [{depth, kind, 1} | rest]}
  defp counted(open, depth, kind), do: {1, [{depth, kind, 1} | open]}

  # Returns a block paired with its number as plain text: a paragraph's lines
  # as they are, and a list item's lines after its marker and indentation.
  defp written_block({item = %{"type" => "list-item", "depth" => depth}, number}) do
    indent = String.duplicate("  ", depth)
    marker = if item["list"] == "numbered", do: "#{number}. ", else: "- "
    hanging = indent <> String.duplicate(" ", String.length(marker))
    [first | rest] = plain_lines(item["children"])

    [indent <> marker <> first | Enum.map(rest, &(hanging <> &1))]
    |> Enum.map_join("\n", &String.trim_trailing/1)
  end

  defp written_block({paragraph, nil}), do: Enum.join(plain_lines(paragraph["children"]), "\n")

  @doc ~S"""
  Returns the rich text that plain `text` holds, or nil when `text` is nil or
  blank.

  Line endings are read as `"\n"`, whether written as `"\r\n"`, `"\r"` or
  `"\n"`. One or more blank lines start a new paragraph, and a single line
  break inside a paragraph is a line break in its text. Each paragraph is
  trimmed, and the whitespace at the end of each line is dropped.

  Each bare URL in the text becomes a link. Words are separated by
  whitespace, line breaks included. A word is a bare URL when, without the
  punctuation at its end, any of `.,;:!?)]'"`, it starts with `http://`,
  `https://` or `www.`, in any case, followed by a character other than a
  full stop, or it is an email address. An email address is text, `@`, and a
  domain with a full stop inside it, none of which holds whitespace, `@`,
  `<`, `>`, parentheses or square brackets.

  The link's text is the bare URL as written, and the punctuation after it
  stays in the text that follows the link. The link goes to:

    * the bare URL itself, when it starts with `http://`, `https://` or
      `mailto:`, in any case.
    * the bare URL after `mailto:`, when it is any other email address.
    * the bare URL after `https://`, when it is a web address: names of
      ASCII letters, digits, `_` and `-` joined by full stops, followed by
      nothing, or by a path, query or fragment that starts with `/`, `?` or
      `#`.

  A bare URL that is none of these stays text. No other formatting is read:
  every block is a paragraph, and the text around the links is in runs
  without marks.

  ## Examples

      iex> RichardBurton.RichText.from_plain_text("First edition,\r\nin English.\n\n\nBound in cloth. ")
      [
        %{"type" => "paragraph", "children" => [%{"text" => "First edition,\nin English."}]},
        %{"type" => "paragraph", "children" => [%{"text" => "Bound in cloth."}]}
      ]

      iex> RichardBurton.RichText.from_plain_text("See www.example.com/catalogue.")
      [
        %{"type" => "paragraph", "children" => [
          %{"text" => "See "},
          %{"type" => "link", "url" => "https://www.example.com/catalogue",
            "children" => [%{"text" => "www.example.com/catalogue"}]},
          %{"text" => "."}
        ]}
      ]

      iex> RichardBurton.RichText.from_plain_text(" \n ")
      nil
  """
  @spec from_plain_text(String.t() | nil) :: t() | nil
  def from_plain_text(nil), do: nil

  def from_plain_text(text) when is_binary(text) do
    text
    |> String.split(~r/\r\n?|\n/)
    |> Enum.map(&String.trim_trailing/1)
    |> Enum.chunk_by(&(&1 == ""))
    |> Enum.reject(&(hd(&1) == ""))
    |> Enum.map(&paragraph/1)
    |> case do
      [] -> nil
      blocks -> blocks
    end
  end

  # Returns a paragraph of `lines` joined by line breaks and trimmed, with
  # each bare URL in it made a link.
  defp paragraph(lines) do
    text = lines |> Enum.join("\n") |> String.trim()
    %{"type" => "paragraph", "children" => linked(text)}
  end

  # The punctuation at the end of a word that is not part of a bare URL, the
  # start of a word that is a bare URL, and an email address. See
  # `from_plain_text/1`.
  @trailing_punctuation ~r/[.,;:!?)\]'"]+\z/u
  @url_start ~r/\A(https?:\/\/|www\.)[^\s.]/iu
  @email ~r/\A[^\s@<>()\[\]]+@[^\s@<>()\[\]]+\.[^\s@<>()\[\]]+\z/u

  # A bare URL that a link goes to as it is written, and a web address that a
  # link goes to after `https://`.
  @scheme_url ~r/\A(https?:\/\/|mailto:)\S/iu
  @web_address ~r/\A[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)+([\/?#]\S*)?\z/u

  # Returns the inlines of trimmed `text`: a link for each bare URL in it, and
  # runs of the text before, between and after the links. No run is empty.
  defp linked(text) do
    ~r/\s+/u
    |> Regex.split(text, include_captures: true)
    |> Enum.reduce([], &add_word/2)
    |> Enum.reject(&(&1 == %{"text" => ""}))
    |> Enum.reverse()
  end

  # Adds `word`, a word or the whitespace between two words, to `inlines`,
  # which are in reverse order. A bare URL adds its link, and then a run of
  # the punctuation after it, which may be empty. Anything else is added to
  # the end of the run at the head of `inlines`, or as a new run when the head
  # is a link or there is none.
  defp add_word(word, inlines) do
    case {bare_url(word), inlines} do
      {{text, url}, inlines} ->
        after_url = binary_part(word, byte_size(text), byte_size(word) - byte_size(text))
        link = %{"type" => "link", "url" => url, "children" => [%{"text" => text}]}
        [%{"text" => after_url}, link | inlines]

      {nil, [%{"text" => before} | earlier]} ->
        [%{"text" => before <> word} | earlier]

      {nil, inlines} ->
        [%{"text" => word} | inlines]
    end
  end

  # Returns `{text, url}` when `word` is a bare URL: the text of its link,
  # which is the word without the punctuation at its end, and the URL the link
  # goes to. Returns nil when the word is not a bare URL, or is one that
  # `from_plain_text/1` leaves as text.
  defp bare_url(word) do
    text = String.replace(word, @trailing_punctuation, "")

    if Regex.match?(@url_start, text) or Regex.match?(@email, text) do
      case link_target(text) do
        nil -> nil
        url -> {text, url}
      end
    end
  end

  # Returns the URL a link to the bare URL `text` goes to, as
  # `from_plain_text/1` lists them, or nil when it is none of those.
  defp link_target(text) do
    cond do
      Regex.match?(@scheme_url, text) -> text
      Regex.match?(@email, text) -> "mailto:" <> text
      Regex.match?(@web_address, text) -> "https://" <> text
      true -> nil
    end
  end
end
