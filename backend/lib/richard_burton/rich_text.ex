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
  other than the ones listed for it. A value is **blank** when the text of its
  runs, the runs of its links included, is empty or only whitespace.

  Casting a value checks this shape, turns atom keys into strings, and returns
  nil for a blank value or an empty list. A value of any other shape, or one
  with more than 10,000 nodes, fails to cast with the validation
  `:malformed`.
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
  def cast([]), do: {:ok, nil}

  def cast(value) when is_list(value) do
    blocks = stringified(value)

    cond do
      not Enum.all?(blocks, &block?/1) -> {:error, validation: :malformed}
      node_count(blocks) > @max_nodes -> {:error, validation: :malformed}
      blank?(blocks) -> {:ok, nil}
      true -> {:ok, blocks}
    end
  end

  def cast(_value), do: {:error, validation: :malformed}

  @impl true
  def load(blocks) when is_list(blocks), do: {:ok, blocks}
  def load(_value), do: :error

  @impl true
  def dump(blocks) when is_list(blocks), do: {:ok, blocks}
  def dump(_value), do: :error

  # Returns a term with the atom keys of every map in it turned into strings.
  defp stringified(map) when is_map(map) and not is_struct(map) do
    Map.new(map, fn {key, value} -> {key_string(key), stringified(value)} end)
  end

  defp stringified(list) when is_list(list), do: Enum.map(list, &stringified/1)
  defp stringified(term), do: term

  # Returns an atom key as a string, and any other key as it is.
  defp key_string(key) when is_atom(key), do: Atom.to_string(key)
  defp key_string(key), do: key

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
  it is numbered, indented by two spaces for each level of depth. The first
  item of a run of items is written at depth 0, and each item after it at
  most one level deeper than the item before it. The lines after a line break
  in a list item are indented to line up with the item's text.

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
    |> leveled()
    |> numbered()
    |> Enum.map_join("\n", &written_block/1)
  end

  # Returns blocks with the depth of each list item lowered to at most one
  # more than the depth of the item before it, which puts the first item at
  # depth 0.
  defp leveled(blocks) do
    {leveled, _before} =
      Enum.map_reduce(blocks, -1, fn
        item = %{"type" => "list-item", "depth" => depth}, before ->
          depth = min(depth, before + 1)
          {%{item | "depth" => depth}, depth}

        block, before ->
          {block, before}
      end)

    leveled
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
  trimmed, and the whitespace at the end of each line is dropped. No other
  formatting is read: every block is a paragraph with a single run of text.

  ## Examples

      iex> RichardBurton.RichText.from_plain_text("First edition,\r\nin English.\n\n\nBound in cloth. ")
      [
        %{"type" => "paragraph", "children" => [%{"text" => "First edition,\nin English."}]},
        %{"type" => "paragraph", "children" => [%{"text" => "Bound in cloth."}]}
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

  # Returns a paragraph of one run of text: `lines` joined by line breaks,
  # trimmed.
  defp paragraph(lines) do
    text = lines |> Enum.join("\n") |> String.trim()
    %{"type" => "paragraph", "children" => [%{"text" => text}]}
  end
end
