defmodule RichardBurton.Publication.Index.Term do
  @moduledoc """
  Parses a search term into the structure `Publication.Index` builds a query from.

  Terms used here:

    * **term** — everything the reader typed, as a single string.
    * **alternative** — a part of a term that can satisfy it on its own. `:or`
      (or `:ou`) separates them, so a term without `:or` is one alternative.
    * **operator** — the `field:value` form as written, such as `title:casmurro`.
    * **filter** — an operator after parsing: the column it names, its value, and
      whether it was quoted or negated. The operator is what gets typed; the
      filter is what the query gets built from.

  An alternative holds free words and filters, and matches only when both do.

      title:casmurro          matches the title only
      year:1950-1960          matches a year range
      -country:US             excludes
      title:"dom casmurro"    matches the words in that order
      title:(dom casmurro)    matches both words in any order

  An operator's value is matched the same way a free word is — by prefix, falling
  back to similar words — unless it is quoted, in which case it is matched
  exactly as written.

  Every operator answers to an English name and a Portuguese one. Case and accents
  are ignored when matching them, and a two-word name may be written with either a
  hyphen or an underscore.

  Anything before a colon that is not a known name is not an operator at all:
  `foo:bar` is parsed as ordinary text. That way a colon typed inside a title does
  not break the search.
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
  Whether a term contains no operators, and so searches no field in particular.

  ## Examples

      iex> RichardBurton.Publication.Index.Term.plain?(RichardBurton.Publication.Index.Term.parse("dom casmurro"))
      true

      iex> RichardBurton.Publication.Index.Term.plain?(RichardBurton.Publication.Index.Term.parse("title:casmurro"))
      false
  """
  @spec plain?([alternative]) :: boolean
  def plain?(alternatives), do: Enum.all?(alternatives, &(&1.filters == []))

  # The name a field is reported by: the English one of the several it answers
  # to, and the one that can be written back into a term.
  @names %{
    title: "title",
    original_title: "original",
    authors: "translator",
    original_authors: "author",
    countries: "country",
    publishers: "publisher",
    year: "year",
    references: "source"
  }

  @doc """
  The name used to write an operator on this field.

  A field answers to several names. This returns the English one, which is the
  name reported for the field and the name that can be written back into a term.

  ## Examples

      iex> RichardBurton.Publication.Index.Term.name(:original_authors)
      "author"

      iex> RichardBurton.Publication.Index.Term.name(:references)
      "source"
  """
  @spec name(atom) :: String.t()
  def name(field), do: Map.fetch!(@names, field)

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

  @doc """
  A word in the form the index holds it: lowercased, with accents removed.

  Operator names are compared in this form, so `TÍTULO`, `título` and `titulo` are
  all the same name and it only has to be listed once. The search configuration's
  `unaccent` puts values into the same form, which makes this the way to tell
  whether a word the index returned is the one that was typed.

  ## Examples

      iex> RichardBurton.Publication.Index.Term.fold("Angústia")
      "angustia"
  """
  @spec fold(String.t()) :: String.t()
  def fold(name) do
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
