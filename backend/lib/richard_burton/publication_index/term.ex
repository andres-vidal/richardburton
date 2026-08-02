defmodule RichardBurton.Publication.Index.Term do
  @moduledoc """
  What a reader typed, read as a question.

  A term is free text — words to look for anywhere in a publication — with two
  things picked out of it: the alternatives `:or` separates, and the operators
  that name a single field. `title:casmurro` asks of the title alone;
  `year:1950-1960` asks for a span of years; a leading `-` excludes rather than
  requires; `title:"dom casmurro"` asks for those words in that order; and
  `title:(dom casmurro)` asks for both of them, in any.

  Operators answer to three vocabularies — the labels the interface uses, the
  names the database uses, and Portuguese — because the reader of a database of
  Brazilian literature should not have to know which language it was built in.
  A prefix this does not recognise is not an operator at all: `foo:bar` is
  searched for as the words it looks like, which is friendlier than refusing a
  query over a colon someone typed in a title.
  """

  @type filter :: %{field: atom, value: String.t(), exact: boolean, negated: boolean}
  @type alternative :: %{words: [String.t()], filters: [filter]}

  # Every name an operator answers to, in English and in Portuguese.
  #
  # Each is singular, because asking for more than one of something is asking
  # the same operator twice — `author:machado author:assis` wants both — and a
  # plural spelling would only be a second way to say the same thing.
  #
  # `author` names whoever wrote the book, though the column holding the
  # translators is the one called `authors`. That is the database's word for
  # them, and it has no business reaching the person typing: the one who
  # rendered a book is asked for as `translator`.
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

  # A token runs until a space, except that a quoted or bracketed stretch is
  # part of it and may hold spaces — so `title:"dom casmurro"` and
  # `title:(dom casmurro)` are each one token, not two.
  @token ~r/(?:[^\s"()]+|"[^"]*"|\([^)]*\))+/
  @operator ~r/^(?<negated>-?)(?<field>[^\s:"]+):(?<value>.*)$/s
  @alternator ~r/^:(or|ou)$/i

  @doc "The fields an operator can name, against every word that names them."
  def fields, do: @fields

  @doc """
  Read a term as the alternatives it offers, each a set of words to look for and
  the filters that narrow them. A term with no operators is one alternative of
  words, which is what the search has always been.
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

  defp read_alternative(tokens) do
    {filters, words} = Enum.split_with(tokens, &operator?/1)

    %{
      words: Enum.map(words, &unquoted/1),
      filters: Enum.map(filters, &read_filter/1)
    }
  end

  defp operator?(token) do
    case Regex.named_captures(@operator, token) do
      nil -> false
      %{"field" => field, "value" => value} -> known?(field) and value != ""
    end
  end

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

  defp known?(field), do: Map.has_key?(@fields, String.downcase(field))

  defp quoted?(value), do: wrapped?(value, ~s("), ~s("))

  # Several words asked of one field, in any order: `title:(dom casmurro)`.
  # Quoting would ask for them in that order, which is a different question.
  defp grouped?(value), do: wrapped?(value, "(", ")")

  defp wrapped?(value, opening, closing),
    do:
      String.length(value) >= 2 and String.starts_with?(value, opening) and
        String.ends_with?(value, closing)

  defp unquoted(value) do
    if quoted?(value) or grouped?(value),
      do: String.slice(value, 1..-2//1),
      else: value
  end

  @doc """
  A year operator's value as the span it names: `1950` is that year alone,
  `1950-1960` the years between, and an open end (`1950-`, `-1960`) everything
  from or up to it. Anything else is not a span, and the operator is ignored
  rather than answered wrongly.
  """
  @spec span(String.t()) :: {integer | nil, integer | nil} | :none
  def span(value) do
    case String.split(value, "-", parts: 2) do
      [year] -> single(year)
      [from, to] -> range(from, to)
    end
  end

  defp single(year) do
    case Integer.parse(String.trim(year)) do
      {year, ""} -> {year, year}
      _ -> :none
    end
  end

  defp range(from, to) do
    case {edge(from), edge(to)} do
      {:invalid, _} -> :none
      {_, :invalid} -> :none
      {nil, nil} -> :none
      {from, to} -> {from, to}
    end
  end

  defp edge(""), do: nil

  defp edge(value) do
    case Integer.parse(String.trim(value)) do
      {year, ""} -> year
      _ -> :invalid
    end
  end
end
