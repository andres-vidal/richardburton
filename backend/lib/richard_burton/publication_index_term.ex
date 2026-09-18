defmodule RichardBurton.Publication.Index.Term do
  @moduledoc """
  Parses a search term into the structure `Publication.Index` builds a query from.

  Four words carry specific meanings here:

    * **term** — everything the reader typed, as one string.
    * **alternative** — a part of a term that can satisfy it on its own. `:or`
      (or `:ou`) separates them; a term without `:or` is a single alternative.
    * **operator** — the `field:value` form as it is written, such as
      `title:casmurro`.
    * **filter** — one operator once parsed: the column it names, its value, and
      whether it was quoted or negated. An operator is what the reader types; a
      filter is what the query is built from.

  An alternative holds free words and filters, and matches when both match.

      title:casmurro          matches the title only
      year:1950-1960          matches a year range
      -country:US             excludes
      title:"dom casmurro"    matches the words in that order
      title:(dom casmurro)    matches both words in any order

  Operator values match like free words — by prefix, with a fuzzy fallback —
  unless quoted, which matches them as written.

  Each operator accepts an English name and a Portuguese one, matched with case
  and accents folded away; a name of two words is accepted hyphenated or
  underscored.

  An unrecognised prefix is not an operator: `foo:bar` parses as free text, so a
  colon typed inside a title does not fail the query.
  """

  @type filter :: %{field: atom, value: String.t(), exact: boolean, negated: boolean}
  @type alternative :: %{words: [String.t()], filters: [filter]}

  # Operator names, English and Portuguese, mapped to the column they filter.
  #
  # Names are singular: repeating an operator (`author:machado author:assis`)
  # already means both, so a plural would be a second name for the same thing.
  #
  # `author` maps to `original_authors`, the book's author. The column named
  # `authors` holds the translators, which `translator` maps to.
  @fields %{
    "title" => :title,
    "titulo" => :title,
    "original" => :original_title,
    "original-title" => :original_title,
    "original_title" => :original_title,
    "titulo-original" => :original_title,
    "titulo_original" => :original_title,
    "translator" => :authors,
    "tradutor" => :authors,
    "author" => :original_authors,
    "autor" => :original_authors,
    "original-author" => :original_authors,
    "original_author" => :original_authors,
    "country" => :countries,
    "pais" => :countries,
    "publisher" => :publishers,
    "editora" => :publishers,
    "year" => :year,
    "ano" => :year,
    "source" => :references,
    "fonte" => :references
  }

  # A token ends at a space, except inside quotes or brackets, so
  # `title:"dom casmurro"` and `title:(dom casmurro)` are each one token.
  @token ~r/(?:[^\s"()]+|"[^"]*"|\([^)]*\))+/
  @operator ~r/^(?<negated>-?)(?<field>[^\s:"]+):(?<value>.*)$/s
  @alternator ~r/^:(or|ou)$/i

  @doc """
  Parses a term into its alternatives, each holding the free words and the field
  filters it contains. A term with no operators parses to one alternative of
  words.

  ## Examples

      iex> RichardBurton.Publication.Index.Term.parse("dom casmurro")
      [%{words: ["dom", "casmurro"], filters: []}]

      iex> RichardBurton.Publication.Index.Term.parse("casmurro :or iracema")
      [%{words: ["casmurro"], filters: []}, %{words: ["iracema"], filters: []}]

  An operator becomes a filter naming the column it scopes to, here through its
  Portuguese name:

      iex> RichardBurton.Publication.Index.Term.parse("ano:1950")
      [%{words: [], filters: [%{field: :year, value: "1950", exact: false, negated: false}]}]

  A leading minus negates it, and words alongside it stay free:

      iex> RichardBurton.Publication.Index.Term.parse("machado -country:US")
      [
        %{
          words: ["machado"],
          filters: [%{field: :countries, value: "US", exact: false, negated: true}]
        }
      ]

  A quoted value is exact; a bracketed one is not:

      iex> RichardBurton.Publication.Index.Term.parse(~s(title:"dom casmurro"))
      [
        %{
          words: [],
          filters: [%{field: :title, value: "dom casmurro", exact: true, negated: false}]
        }
      ]

      iex> RichardBurton.Publication.Index.Term.parse("title:(dom casmurro)")
      [
        %{
          words: [],
          filters: [%{field: :title, value: "dom casmurro", exact: false, negated: false}]
        }
      ]

  A prefix that names no field is read as free text rather than as an operator:

      iex> RichardBurton.Publication.Index.Term.parse("foo:bar")
      [%{words: ["foo:bar"], filters: []}]
  """
  @spec parse(String.t()) :: [alternative]
  def parse(term) when is_binary(term) do
    @token
    |> Regex.scan(term)
    |> Enum.map(&hd/1)
    |> Enum.chunk_by(&(&1 =~ @alternator))
    |> Enum.reject(&(hd(&1) =~ @alternator))
    |> Enum.map(&read_alternative/1)
    |> Enum.reject(&(&1.words == [] and &1.filters == []))
  end

  @doc """
  Whether a term carries no operators, and so asks for nothing of a single field.

  ## Examples

      iex> RichardBurton.Publication.Index.Term.plain?(RichardBurton.Publication.Index.Term.parse("dom casmurro"))
      true

      iex> RichardBurton.Publication.Index.Term.plain?(RichardBurton.Publication.Index.Term.parse("title:casmurro"))
      false
  """
  @spec plain?([alternative]) :: boolean
  def plain?(alternatives), do: Enum.all?(alternatives, &(&1.filters == []))

  # Splits one alternative's tokens into the operators and the free words, and
  # strips the quotes or brackets the words were written in.
  defp read_alternative(tokens) do
    {filters, words} = Enum.split_with(tokens, &operator?/1)

    %{
      words: Enum.map(words, fn word -> word |> delimited() |> elem(1) end),
      filters: Enum.map(filters, &read_filter/1)
    }
  end

  # A token is an operator only if its prefix names a known field and it carries
  # a value; `foo:bar` and `title:` are free text.
  defp operator?(token) do
    case Regex.named_captures(@operator, token) do
      nil -> false
      %{"field" => field, "value" => value} -> known?(field) and value != ""
    end
  end

  # The field the operator names, its value stripped of quotes or brackets, and
  # whether it was quoted (matched as a phrase) or negated.
  defp read_filter(token) do
    %{"negated" => negated, "field" => field, "value" => value} =
      Regex.named_captures(@operator, token)

    {kind, value} = delimited(value)

    %{
      field: Map.fetch!(@fields, fold(field)),
      value: value,
      exact: kind == :phrase,
      negated: negated == "-"
    }
  end

  # Whether a prefix names a field, in any of the names that field accepts.
  defp known?(field), do: Map.has_key?(@fields, fold(field))

  # Operator names are matched with case and accents folded away, so `TÍTULO`,
  # `título` and `titulo` are one name and each is listed once. Values are
  # already compared this way, through the search configuration's `unaccent`.
  defp fold(name) do
    name
    |> String.downcase()
    |> :unicode.characters_to_nfd_binary()
    |> String.replace(~r/[\x{0300}-\x{036F}]/u, "")
  end

  # A value read through its delimiters: `"..."` is a phrase, matched in the
  # order written; `(...)` is several words of one field, matched in any order;
  # anything else is a bare value. Returns the kind and the value without them.
  # A delimiter counts only in a matching pair, so `"abc`, `(abc` and a lone `"`
  # are bare and keep the character they carry.
  defp delimited(value) when byte_size(value) < 2, do: {:bare, value}

  defp delimited(value) do
    case {String.first(value), String.last(value)} do
      {~s("), ~s(")} -> {:phrase, inner(value)}
      {"(", ")"} -> {:group, inner(value)}
      _ -> {:bare, value}
    end
  end

  # A value without the delimiters around it.
  defp inner(value), do: String.slice(value, 1..-2//1)

  @doc """
  Parses a `year` operator value into `{from, to}`, where either bound may be
  nil: `1950` gives `{1950, 1950}`, `1950-1960` gives `{1950, 1960}`, `1950-`
  gives `{1950, nil}` and `-1960` gives `{nil, 1960}`. Returns `:none` for
  anything else, which the caller matches nothing against rather than dropping
  the operator.

  ## Examples

      iex> RichardBurton.Publication.Index.Term.span("1950")
      {1950, 1950}

      iex> RichardBurton.Publication.Index.Term.span("1950-1960")
      {1950, 1960}

      iex> RichardBurton.Publication.Index.Term.span("1950-")
      {1950, nil}

      iex> RichardBurton.Publication.Index.Term.span("-1960")
      {nil, 1960}

      iex> RichardBurton.Publication.Index.Term.span("recently")
      :none

      iex> RichardBurton.Publication.Index.Term.span("-")
      :none
  """
  @spec span(String.t()) :: {integer | nil, integer | nil} | :none
  def span(value) do
    case String.split(value, "-", parts: 2) do
      [year] -> range(year, year)
      [from, to] -> range(from, to)
    end
  end

  # A range needs both edges parseable and at least one of them present, so `-`
  # alone names nothing.
  defp range(from, to) do
    case {edge(from), edge(to)} do
      {:invalid, _} -> :none
      {_, :invalid} -> :none
      {nil, nil} -> :none
      {from, to} -> {from, to}
    end
  end

  # One side of a range: an absent bound is nil, an unparseable one `:invalid`,
  # which are different answers — the first is open, the second is a mistake.
  defp edge(""), do: nil

  defp edge(value) do
    case Integer.parse(String.trim(value)) do
      {year, ""} -> year
      _ -> :invalid
    end
  end
end
