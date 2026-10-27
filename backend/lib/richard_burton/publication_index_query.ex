defmodule RichardBurton.Publication.Index.Query do
  @moduledoc """
  Builds the query a parsed search term resolves to: the `WHERE` and
  `ORDER BY` expressions that `Publication.Index` runs for the alternatives
  `Publication.Index.Term.parse/1` returns. Nothing here reads a publication.

  Terms used here:

    * **criteria** — a term ready to query with, and a tag the code matches on:
      `{:spelled_out, term}` for one handed to Postgres verbatim, or
      `{:alternatives, alternatives}` for one parsed into, per alternative, a
      tsquery for its free words and a predicate for each of its filters.
    * **predicate** — one condition a publication has to satisfy, held as an Ecto
      `dynamic` so it can be combined with others and spliced into the `WHERE`.

  A free word is matched against the whole search document; an operator against
  the single column it names. That is why a term carrying operators cannot be
  one tsquery string, and is composed from predicates instead.
  """

  import Ecto.Query

  alias RichardBurton.Country
  alias RichardBurton.Publication.Index.Keywords
  alias RichardBurton.Publication.Index.Term

  # The columns holding several values, which are matched as one joined string.
  # `countries` holds several values too, but its value is resolved to country
  # codes rather than matched as text. See `text_predicate/2`.
  # The sources are matched as the texts of both languages, in
  # `text_predicate/2`'s own clause.
  @list_fields [:publishers, :authors, :original_authors]

  @doc """
  Returns the standing of every word of a term that is matched against the
  index's words, keyed by the word and looked up with one query. See
  `Keywords.standings/1`.

  The words are the free words, and the words of each unquoted operator value
  that is matched as text, which excludes a year and a country. A term that
  Postgres reads as written (see `spelled_out?/1`) looks nothing up and gets an
  empty map.
  """
  @spec standings(String.t()) :: %{String.t() => Keywords.standing()}
  def standings(term) do
    alternatives = Term.parse(term)

    if Term.plain?(alternatives) and spelled_out?(term),
      do: %{},
      else: alternatives |> Enum.flat_map(&looked_up/1) |> Keywords.standings()
  end

  # The words of an alternative that are looked up in the index's words: its
  # free words, and the words of the filter values matched as text.
  defp looked_up(%{words: words, filters: filters}),
    do: words ++ Enum.flat_map(filters, &value_words/1)

  # The words of a filter's value that are looked up. A year is a range and a
  # country is resolved to codes, and a quoted value is matched as the phrase
  # it is, so none of those has words to look up.
  defp value_words(%{field: field}) when field in [:year, :countries], do: []
  defp value_words(%{exact: true}), do: []
  defp value_words(%{value: value}), do: Keywords.words(value)

  @doc """
  A parsed term as criteria: for each alternative, the tsquery for its free words
  and the predicate of each of its filters.

  `standings` must hold the standing of every word that `standings/1` looks up
  for the term.
  """
  def criteria(alternatives, standings) do
    {:alternatives,
     Enum.map(alternatives, fn alternative ->
       %{
         query: words_query(alternative.words, standings),
         predicates: Enum.map(alternative.filters, &filter_predicate(&1, standings))
       }
     end)}
  end

  @doc """
  Whether criteria found anything to search for. A term whose every word resolved to
  nothing, and which carries no filter, asks for nothing at all.
  """
  def empty?({:alternatives, alternatives}),
    do: Enum.all?(alternatives, &(&1.query == nil and &1.predicates == []))

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

  Reads the word's standing from `standings` and renders whichever way it
  matched: a word that begins indexed words becomes a prefix query, and one that
  begins none becomes the list of words it resembles. A word the index does not
  hold at all has no tsquery, and the caller decides what that means.

  This is the one place a word becomes a query, so a row is highlighted by the
  same thing that matched it.
  """
  @spec word_query(String.t(), %{String.t() => Keywords.standing()}) :: String.t() | nil
  def word_query(word, standings) do
    case Map.fetch!(standings, word) do
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
  defp alternative_predicate(%{query: query, predicates: predicates}) do
    [words_predicate(query) | predicates]
    |> Enum.reject(&is_nil/1)
    |> all_of()
  end

  # Combines predicates with AND. An empty list is `false` rather than the `true`
  # that AND would suggest, so an alternative left with nothing usable excludes
  # itself instead of matching every publication.
  defp all_of([]), do: dynamic(false)
  defp all_of(predicates), do: Enum.reduce(predicates, &dynamic(^&2 and ^&1))

  # Combines predicates with OR.
  defp any_of([]), do: dynamic(false)
  defp any_of(predicates), do: Enum.reduce(predicates, &dynamic(^&2 or ^&1))

  # The free words matched against the whole search document. An alternative of
  # only operators has none, and contributes no predicate.
  defp words_predicate(nil), do: nil

  defp words_predicate(query),
    do: dynamic(fragment("document @@ to_tsquery('rb_search', ?)", ^query))

  # The condition one operator puts on a publication. A `year` compares that column
  # as a number against the range its value parses into. Every other operator
  # matches the column it names as text, rather than matching the search document.
  #
  # A value that parses into no range matches nothing, rather than the operator
  # being dropped, which would widen a term the reader narrowed.
  #
  # `standings` holds the standing of each word of a value matched as text.
  defp filter_predicate(%{field: :year, value: value, negated: negated}, _standings) do
    case Term.span(value) do
      :none -> negate(dynamic(false), negated)
      {from, to} -> negate(year_predicate(from, to), negated)
    end
  end

  defp filter_predicate(%{field: :countries, value: value, negated: negated}, _standings) do
    negate(countries_predicate(Country.answering(value)), negated)
  end

  defp filter_predicate(filter = %{field: field, negated: negated}, standings) do
    negate(text_predicate(field, value_query(filter, standings)), negated)
  end

  # The column holds codes and the reader writes a name, so the value is
  # resolved to codes first. That is how `country:GBR`, `country:Brasil` and
  # `country:Holanda` all reach their country.
  #
  # A value naming none matches nothing. Dropping the operator instead would
  # widen a term the reader narrowed.
  defp countries_predicate([]), do: dynamic(false)

  defp countries_predicate(codes) do
    dynamic([p], fragment("? && ?", p.countries, ^codes))
  end

  # A filter written with a leading minus excludes what it would otherwise match.
  defp negate(predicate, false), do: predicate
  defp negate(predicate, true), do: dynamic(not (^predicate))

  # A year range compared as integers rather than text, with a nil bound leaving
  # that end open.
  defp year_predicate(nil, to), do: dynamic([p], p.year <= ^to)
  defp year_predicate(from, nil), do: dynamic([p], p.year >= ^from)
  defp year_predicate(from, to), do: dynamic([p], p.year >= ^from and p.year <= ^to)

  # A list column is matched as its joined text, the same form
  # `search_documents` indexes it in. The join goes through `rb_joined`, which is
  # declared immutable so that this expression can be indexed. The sources are
  # matched as the Portuguese texts followed by the English ones, the
  # expression the view's sources index is built on.
  defp text_predicate(:sources, query) do
    dynamic(
      [p],
      fragment(
        "to_tsvector('rb_search', rb_joined(? || ?)) @@ ?",
        p.sources_pt,
        p.sources_en,
        ^query
      )
    )
  end

  defp text_predicate(field, query) when field in @list_fields do
    dynamic(
      [p],
      fragment("to_tsvector('rb_search', rb_joined(?)) @@ ?", field(p, ^field), ^query)
    )
  end

  defp text_predicate(field, query) do
    dynamic(
      [p],
      fragment("to_tsvector('rb_search', coalesce(?::text, '')) @@ ?", field(p, ^field), ^query)
    )
  end

  # A quoted value matches as a phrase, exactly as written.
  defp value_query(%{value: value, exact: true}, _standings),
    do: dynamic(fragment("phraseto_tsquery('rb_search', ?)", ^value))

  # Any other value matches word by word, every word required.
  defp value_query(%{value: value, exact: false}, standings) do
    query =
      value
      |> Keywords.words()
      |> Enum.map(&value_word_query(&1, standings))
      |> all_words()

    dynamic(fragment("to_tsquery('rb_search', ?)", ^query))
  end

  # One word of a value, as a tsquery: its prefix form, plus whatever it resembles
  # if the index holds nothing beginning with it.
  #
  # The prefix is kept even when the keyword view knows nothing of the word, where
  # a free word would be dropped instead. That view is built from the search
  # document, so it holds only countries some publication uses, while an
  # operator is answered from the whole country table.
  defp value_word_query(word, standings) do
    prefix = "#{lexeme(word)}:*"

    case Map.fetch!(standings, word) do
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
  defp words_query([], _standings), do: nil

  defp words_query(words, standings) do
    case words |> Enum.map(&word_query(&1, standings)) |> Enum.reject(&is_nil/1) do
      [] -> nil
      queries -> all_words(queries)
    end
  end

  # Every word required.
  defp all_words(queries), do: Enum.map_join(queries, " & ", &"(#{&1})")
end
