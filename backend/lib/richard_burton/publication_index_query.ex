defmodule RichardBurton.Publication.Index.Query do
  @moduledoc """
  Builds the query a parsed search term resolves to.

  `Publication.Index.Term` says what a reader asked for; this says how to ask it
  of the database. Nothing here reads a publication — it returns the `WHERE` and
  `ORDER BY` fragments `Publication.Index` runs.

  Two words carry specific meanings here, both appearing as tags in the code:

    * **ask** — a term ready to query with: `{:spelled_out, term}` for one handed
      to Postgres verbatim, or `{:alternatives, alternatives}` for one parsed
      into words and filters.
    * **mode** — how a word is matched: `:prefix` from the start of a word, or
      `:fuzzy` against the indexed words it resembles.

  A free word is matched against the whole search document; an operator against
  the single column it names. That is why a term carrying operators cannot be
  one tsquery string, and is composed from predicates instead.
  """

  import Ecto.Query

  alias RichardBurton.Publication.Index.Keywords
  alias RichardBurton.Publication.Index.Term

  @doc """
  A parsed term as an ask: for each alternative, the tsquery for its free words
  and the filters that narrow it.
  """
  def asked(alternatives, mode) do
    {:alternatives,
     Enum.map(alternatives, fn alternative ->
       %{
         query: words_query(alternative.words, mode),
         filters: alternative.filters,
         mode: mode
       }
     end)}
  end

  @doc """
  Whether an ask found anything to search for — a term whose every word resolved
  to nothing and which carries no filter asks for nothing at all.
  """
  def empty?({:alternatives, alternatives}),
    do: Enum.all?(alternatives, &(&1.query == nil and &1.filters == []))

  def empty?({:spelled_out, _term}), do: false

  @doc """
  Whether a term quotes a phrase or negates a word, which Postgres reads itself
  through `websearch_to_tsquery`.
  """
  def spelled_out?(term), do: String.contains?(term, ~s(")) or term =~ ~r/(^|\s)-\S/

  @doc """
  A word as a tsquery lexeme, quoted so punctuation in it is read as part of the
  word rather than as tsquery syntax.

  Inside the quotes a backslash escapes the next character, so both it and the
  quote have to be escaped in turn — an unescaped trailing backslash would eat
  the closing quote and leave Postgres a tsquery it cannot parse.

  ## Examples

      iex> RichardBurton.Publication.Index.Query.lexeme("caldwell")
      "'caldwell'"

      iex> RichardBurton.Publication.Index.Query.lexeme("o'brien")
      "'o''brien'"
  """
  def lexeme(word) do
    escaped = word |> String.replace("\\", "\\\\") |> String.replace("'", "''")

    "'" <> escaped <> "'"
  end

  @doc "The `WHERE` clause for an ask."
  def matches({:spelled_out, term}),
    do: dynamic(fragment("document @@ websearch_to_tsquery('rb_search', ?)", ^term))

  # A term is satisfied by any of its alternatives.
  def matches({:alternatives, alternatives}) do
    alternatives |> Enum.map(&alternative_predicate/1) |> any_of()
  end

  @doc "The `ORDER BY` expression for an ask: how well each row matches it."
  def ranking({:spelled_out, term}),
    do: dynamic(fragment("ts_rank_cd(document, websearch_to_tsquery('rb_search', ?), 4)", ^term))

  # Ranks on the free words of every alternative; one made only of operators
  # contributes nothing to rank by.
  def ranking({:alternatives, alternatives}) do
    alternatives
    |> Enum.map(& &1.query)
    |> Enum.reject(&is_nil/1)
    |> case do
      [] -> dynamic(0.0)
      queries -> ranking_by(Enum.map_join(queries, " | ", &"(#{&1})"))
    end
  end

  # An alternative is satisfied by its free words and all of its filters.
  defp alternative_predicate(%{query: query, filters: filters, mode: mode}) do
    [words_predicate(query) | Enum.map(filters, &filter_predicate(&1, mode))]
    |> Enum.reject(&is_nil/1)
    |> all_of()
  end

  # Nothing to ask for matches nothing rather than everything, so an alternative
  # whose words and operators were all unusable excludes itself instead of
  # widening the search to every publication.
  defp all_of([]), do: dynamic(false)
  defp all_of(predicates), do: Enum.reduce(predicates, &dynamic(^&2 and ^&1))

  defp any_of([]), do: dynamic(false)
  defp any_of(predicates), do: Enum.reduce(predicates, &dynamic(^&2 or ^&1))

  # The free words matched against the whole search document. An alternative of
  # only operators has none, and contributes no predicate.
  defp words_predicate(nil), do: nil

  defp words_predicate(query),
    do: dynamic(fragment("document @@ to_tsquery('rb_search', ?)", ^query))

  # An operator matches against one column rather than the search document. A
  # quoted value matches as a phrase; anything else by prefix, like free text.
  # An unusable value — an unparseable span, a word absent from the index —
  # matches nothing rather than dropping the operator, which would widen a term
  # the user narrowed.
  defp filter_predicate(%{field: :year, value: value, negated: negated}, _mode) do
    case Term.span(value) do
      :none -> negate(dynamic(false), negated)
      {from, to} -> negate(year_predicate(from, to), negated)
    end
  end

  defp filter_predicate(%{field: field, value: value, exact: exact, negated: negated}, mode) do
    case value_query(value, exact, mode) do
      :none -> negate(dynamic(false), negated)
      query -> negate(text_predicate(field, query), negated)
    end
  end

  # A filter written with a leading minus excludes what it would otherwise match.
  defp negate(predicate, false), do: predicate
  defp negate(predicate, true), do: dynamic(not (^predicate))

  # A year range compared as integers rather than text, with a nil bound leaving
  # that end open.
  defp year_predicate(nil, to), do: dynamic([p], p.year <= ^to)
  defp year_predicate(from, nil), do: dynamic([p], p.year >= ^from)
  defp year_predicate(from, to), do: dynamic([p], p.year >= ^from and p.year <= ^to)

  # `references` is an array, matched as its joined text, the same form
  # `search_documents` indexes it in.
  defp text_predicate(:references, query) do
    dynamic(
      [p],
      fragment("to_tsvector('rb_search', array_to_string(?, ' ')) @@ ?", p.references, ^query)
    )
  end

  defp text_predicate(field, query) do
    dynamic(
      [p],
      fragment("to_tsvector('rb_search', coalesce(?::text, '')) @@ ?", field(p, ^field), ^query)
    )
  end

  # A quoted value matches as a phrase in either mode.
  defp value_query(value, true, _mode),
    do: dynamic(fragment("phraseto_tsquery('rb_search', ?)", ^value))

  defp value_query(value, false, :prefix) do
    query = value |> Keywords.words() |> and_prefixes()
    dynamic(fragment("to_tsquery('rb_search', ?)", ^query))
  end

  # In fuzzy mode each word of the value expands to the indexed words it
  # resembles, as a free word does.
  defp value_query(value, false, :fuzzy) do
    value
    |> Keywords.words()
    |> Enum.map(&Keywords.resolve(&1, :fuzzy))
    |> Enum.split_with(&(&1 == []))
    |> fuzzy_value_query()
  end

  # Builds a query only when every word resolved to at least one keyword. A word
  # that resolved to none is absent from the index, so the value cannot match.
  defp fuzzy_value_query({[], [_ | _] = groups}),
    do: dynamic(fragment("to_tsquery('rb_search', ?)", ^and_fuzzy(groups)))

  defp fuzzy_value_query(_unresolved), do: :none

  # One tsquery's contribution to the rank.
  defp ranking_by(query),
    do: dynamic(fragment("ts_rank_cd(document, to_tsquery('rb_search', ?), 4)", ^query))

  # One alternative's free words as a tsquery: nil when it has none, or when no
  # word resolved to anything in the fuzzy pass.
  defp words_query([], _mode), do: nil
  defp words_query(words, :prefix), do: and_prefixes(words)

  defp words_query(words, :fuzzy) do
    case fuzzy_words(words) do
      [] -> nil
      groups -> and_fuzzy(groups)
    end
  end

  # One alternative's words resolved to the keywords they resemble, dropping any
  # that resolved to none.
  defp fuzzy_words(words) do
    words
    |> Enum.map(&Keywords.resolve(&1, :fuzzy))
    |> Enum.reject(&(&1 == []))
  end

  # Every word required, each matched from its start.
  defp and_prefixes(words), do: Enum.map_join(words, " & ", &"(#{lexeme(&1)}:*)")

  # Every word required, each satisfied by any of the indexed words it resembles.
  defp and_fuzzy(word_groups) do
    Enum.map_join(word_groups, " & ", &"(#{Enum.map_join(&1, " | ", fn w -> lexeme(w) end)})")
  end
end
