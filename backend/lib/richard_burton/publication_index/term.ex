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

  Each operator accepts several names: the label shown in the UI, the database
  column, and the Portuguese term. An unrecognised prefix is not an operator:
  `foo:bar` parses as free text, so a colon typed inside a title does not fail
  the query.
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
    "título" => :title,
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
    "país" => :countries,
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

  # Splits one alternative's tokens into the operators and the free words, and
  # strips the quotes or brackets the words were written in.
  defp read_alternative(tokens) do
    {filters, words} = Enum.split_with(tokens, &operator?/1)

    %{
      words: Enum.map(words, &unquoted/1),
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

    %{
      field: Map.fetch!(@fields, String.downcase(field)),
      value: unquoted(value),
      exact: quoted?(value),
      negated: negated == "-"
    }
  end

  # Whether a prefix names a field, in any of the names that field accepts.
  defp known?(field), do: Map.has_key?(@fields, String.downcase(field))

  # A quoted value matches as a phrase, in the order written.
  defp quoted?(value), do: wrapped?(value, ~s("), ~s("))

  # `title:(dom casmurro)` matches both words in any order; quoting them
  # instead matches them in the order given.
  defp grouped?(value), do: wrapped?(value, "(", ")")

  # Whether a value is enclosed by the given delimiters, which requires at least
  # the two delimiters themselves.
  defp wrapped?(value, opening, closing),
    do:
      String.length(value) >= 2 and String.starts_with?(value, opening) and
        String.ends_with?(value, closing)

  # A value without the quotes or brackets that delimited it, leaving anything
  # else untouched.
  defp unquoted(value) do
    if quoted?(value) or grouped?(value),
      do: String.slice(value, 1..-2//1),
      else: value
  end

  @doc """
  Parses a `year` operator value into `{from, to}`, where either bound may be
  nil: `1950` gives `{1950, 1950}`, `1950-1960` gives `{1950, 1960}`, `1950-`
  gives `{1950, nil}` and `-1960` gives `{nil, 1960}`. Returns `:none` for
  anything else, which the caller matches nothing against rather than dropping
  the operator.
  """
  @spec span(String.t()) :: {integer | nil, integer | nil} | :none
  def span(value) do
    case String.split(value, "-", parts: 2) do
      [year] -> single(year)
      [from, to] -> range(from, to)
    end
  end

  # A lone year is a range with both bounds on it.
  defp single(year) do
    case Integer.parse(String.trim(year)) do
      {year, ""} -> {year, year}
      _ -> :none
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
