defmodule RichardBurton.Publication.Index.Query do
  @moduledoc """
  Builds the query a parsed search term resolves to.

  `Publication.Index.Term` says what a reader asked for; this says how to ask it
  of the database. Nothing here reads a publication. It returns the `WHERE` and
  `ORDER BY` fragments `Publication.Index` runs.

  Two words carry specific meanings here, both appearing as tags in the code:

    * **criteria** — a term ready to query with: `{:spelled_out, term}` for one handed
      to Postgres verbatim, or `{:alternatives, alternatives}` for one parsed
      into words and filters.

  A free word is matched against the whole search document; an operator against
  the single column it names. That is why a term carrying operators cannot be
  one tsquery string, and is composed from predicates instead.
  """

  import Ecto.Query

  alias RichardBurton.Publication.Index.Keywords
  alias RichardBurton.Publication.Index.Term

  @doc """
  A parsed term as criteria: for each alternative, the tsquery for its free words
  and the filters that narrow it.
  """
  def criteria(alternatives) do
    {:alternatives,
     Enum.map(alternatives, fn alternative ->
       %{query: words_query(alternative.words), filters: alternative.filters}
     end)}
  end

  @doc """
  Whether criteria found anything to search for. A term whose every word resolved to
  nothing, and which carries no filter, asks for nothing at all.
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
  Writes a word as a tsquery lexeme, in quotes, so that any punctuation in it is
  read as part of the word instead of as tsquery syntax.

  Inside those quotes a backslash escapes whatever follows it, so backslashes and
  quotes both have to be escaped themselves. A word ending in an unescaped
  backslash would otherwise escape the closing quote, and Postgres would reject
  the whole tsquery.

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

  @doc """
  A word as the tsquery that matches it.

  Reads the word through `Keywords.standing_for/1` and renders whichever way it
  matched: a word that begins indexed words becomes a prefix query, and one that
  begins none becomes the list of words it resembles. A word the index does not
  hold at all has no tsquery, and the caller decides what that means.

  This is the one place a word becomes a query, so a row is highlighted by the
  same thing that matched it.
  """
  @spec word_query(String.t()) :: String.t() | nil
  def word_query(word) do
    case Keywords.standing_for(word) do
      {:prefix, _words} -> "#{lexeme(word)}:*"
      {:fuzzy, []} -> nil
      {:fuzzy, words} -> Enum.map_join(words, " | ", &lexeme/1)
    end
  end

  @doc "The `WHERE` clause for the given criteria."
  def matches({:spelled_out, term}),
    do: dynamic(fragment("document @@ websearch_to_tsquery('rb_search', ?)", ^term))

  # A term is satisfied by any of its alternatives.
  def matches({:alternatives, alternatives}) do
    alternatives |> Enum.map(&alternative_predicate/1) |> any_of()
  end

  @doc "The `ORDER BY` expression for the given criteria: how well each row matches."
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
  defp alternative_predicate(%{query: query, filters: filters}) do
    [words_predicate(query) | Enum.map(filters, &filter_predicate/1)]
    |> Enum.reject(&is_nil/1)
    |> all_of()
  end

  # Nothing to search for matches nothing rather than everything, so an
  # alternative whose words and operators were all unusable excludes itself
  # instead of widening the search to every publication.
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
  # A year whose range does not parse matches nothing, rather than the operator
  # being dropped, which would widen a term the reader narrowed. A value the index
  # does not hold needs no such handling: its tsquery simply matches nothing.
  defp filter_predicate(%{field: :year, value: value, negated: negated}) do
    case Term.span(value) do
      :none -> negate(dynamic(false), negated)
      {from, to} -> negate(year_predicate(from, to), negated)
    end
  end

  defp filter_predicate(%{field: field, value: value, exact: exact, negated: negated}) do
    negate(text_predicate(field, value_query(value, exact)), negated)
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

  # A quoted value matches as a phrase, exactly as written.
  defp value_query(value, true),
    do: dynamic(fragment("phraseto_tsquery('rb_search', ?)", ^value))

  # Any other value matches word by word. A word that begins nothing the index
  # holds is widened to what it resembles, exactly as a free word is. The prefix
  # form is always kept as well, which a free word does not need.
  #
  # The reason is that these two are matched against different things. A free word
  # is matched against the search document, which is what the keyword view is
  # built from, so the view can say whether the word is there. An operator's value
  # is matched against one column, and a column can hold words the document never
  # does: `countries` holds `GB`, while the document holds `United Kingdom`, so
  # `country:GB` matches a word the view has never heard of.
  defp value_query(value, false) do
    query =
      value
      |> Keywords.words()
      |> Enum.map(&value_word_query/1)
      |> all_words()

    dynamic(fragment("to_tsquery('rb_search', ?)", ^query))
  end

  defp value_word_query(word) do
    prefix = "#{lexeme(word)}:*"

    case Keywords.standing_for(word) do
      {:fuzzy, [_ | _] = words} ->
        Enum.map_join([prefix | Enum.map(words, &lexeme/1)], " | ", & &1)

      _ ->
        prefix
    end
  end

  # One tsquery's contribution to the rank.
  defp ranking_by(query),
    do: dynamic(fragment("ts_rank_cd(document, to_tsquery('rb_search', ?), 4)", ^query))

  # One alternative's free words as a tsquery. A word the index does not hold is
  # dropped rather than failing the alternative; an alternative left with no
  # usable word has no tsquery at all.
  defp words_query([]), do: nil

  defp words_query(words) do
    case words |> Enum.map(&word_query/1) |> Enum.reject(&is_nil/1) do
      [] -> nil
      queries -> all_words(queries)
    end
  end

  # Every word required.
  defp all_words(queries), do: Enum.map_join(queries, " & ", &"(#{&1})")
end
