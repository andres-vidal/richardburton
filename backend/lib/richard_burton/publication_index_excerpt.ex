defmodule RichardBurton.Publication.Index.Excerpt do
  @moduledoc """
  What in each field answered a search.

  A row says which publication matched, not what in it did. For every field the
  index searches, this returns that field's matching text with the matched words
  wrapped in `[[ ]]`, in the row's virtual `excerpts` map — keyed by field, and
  nil for a field the search did not match.

  The marking is done here rather than where the row is read because only the
  database knows what counts as a match: which spellings the search
  configuration folds together, and where one word ends. An operator is scoped
  to a field besides, so `title:night` marks the title and nothing else. The
  matched words alone, without the field each was asked of, cannot say that.

  Two words carry specific meanings here:

    * **excerpt** — one field's matching text. A short field comes back whole;
      `references`, which is an array matched as one joined string, comes back
      as a window around the match.
    * **ask** — the tsquery to excerpt each field with, keyed by field. The free
      words are asked of every field; an operator only of the field it named.
  """

  import Ecto.Query

  alias RichardBurton.Publication.Index.Keywords
  alias RichardBurton.Publication.Index.Query
  alias RichardBurton.Publication.Index.Term
  alias RichardBurton.Repo

  # A short field is marked in full. `references` is a whole bibliography joined
  # into one string, so only the stretch that matched comes back.
  @whole "StartSel=[[,StopSel=]],HighlightAll=true"
  @window "StartSel=[[,StopSel=]],MaxFragments=1,MaxWords=16,MinWords=6"

  # The fields an excerpt is built for: those the search document is built from,
  # less `year`, which is a number and has nothing to mark.
  @fields [
    :title,
    :original_title,
    :authors,
    :original_authors,
    :publishers,
    :countries,
    :references
  ]

  # A field's matching text, or nil — when the field has no tsquery to answer,
  # `to_tsquery` is given nil and nothing matches. Written once and expanded per
  # field, since a fragment's SQL has to be a literal.
  defmacrop excerpt(text, query, options) do
    quote do
      fragment(
        """
        CASE WHEN to_tsvector('rb_search', coalesce(?, '')) @@ to_tsquery('rb_search', ?)
        THEN ts_headline('rb_search', coalesce(?, ''), to_tsquery('rb_search', ?), ?) END
        """,
        unquote(text),
        unquote(query),
        unquote(text),
        unquote(query),
        unquote(options)
      )
    end
  end

  @doc """
  The tsquery to excerpt each field with, keyed by field.

  Read from the term alone, the same way the search read it, so a page excerpts
  without being handed what the search resolved to. A field nothing in the term
  asked of comes back with no tsquery, and so with no excerpt.
  """
  def asked(term) do
    alternatives = Term.parse(term)

    if Term.plain?(alternatives) and Query.spelled_out?(term),
      do: spelled_out_ask(term),
      else: parsed_ask(alternatives)
  end

  @doc """
  The words the index read differently from the way they were typed, in the
  order they were typed, each with what it stood for and the field it was asked
  of — `nil` for a free word, which is asked of every field.

  A word the index took as written is not reported: a reader who typed
  `machado` and is told the search was for `machado` has learnt nothing. What is
  worth saying is that `Maries` found `marias`, `marie` and `mario`, because the
  results answer a term nobody typed.

  Read from the same resolution the excerpts are built from, so what a reader is
  told was matched is what was marked on the rows. A quoted value matched as the
  phrase it is and so was never widened; a spelled-out term is read by Postgres
  rather than here. Neither reports anything.
  """
  @spec resolution(String.t()) :: [
          %{field: String.t() | nil, typed: String.t(), words: [String.t()]}
        ]
  def resolution(term) do
    alternatives = Term.parse(term)

    if Term.plain?(alternatives) and Query.spelled_out?(term),
      do: [],
      else: free_widenings(alternatives) ++ scoped_widenings(alternatives)
  end

  # The free words, asked of no field in particular.
  defp free_widenings(alternatives) do
    alternatives |> Enum.flat_map(& &1.words) |> Enum.flat_map(&widening(nil, &1))
  end

  # The words of each operator's value, under the name the operator is written
  # with so a reader can type it back. A negated operator answered nothing, a
  # `year` holds no words, and a quoted value was matched as written.
  defp scoped_widenings(alternatives) do
    alternatives
    |> Enum.flat_map(& &1.filters)
    |> Enum.reject(&(&1.negated or &1.field == :year or &1.exact))
    |> Enum.flat_map(fn filter ->
      filter.value
      |> Keywords.words()
      |> Enum.flat_map(&widening(Term.name(filter.field), &1))
    end)
  end

  # A word is worth reporting when the index answered it with something other
  # than itself: it fell back to what the word resembles, or it began more than
  # the one word. A word that stands for itself alone, and one the index does not
  # hold at all, both report nothing.
  defp widening(field, word) do
    case Keywords.standing_for(word) do
      {_how, []} -> []
      {:prefix, [only]} -> if Term.fold(word) == only, do: [], else: report(field, word, [only])
      {_how, words} -> report(field, word, words)
    end
  end

  # Likest first, as the index returned them, so the nearest answer reads before
  # the ones that only just cleared the threshold.
  defp report(field, word, words), do: [%{field: field, typed: word, words: words}]

  @doc "Adds each field's excerpt to a query."
  def select(query, ask) do
    select_merge(query, [p], %{
      excerpts: %{
        title: excerpt(p.title, ^ask.title, @whole),
        original_title: excerpt(p.original_title, ^ask.original_title, @whole),
        authors: excerpt(p.authors, ^ask.authors, @whole),
        original_authors: excerpt(p.original_authors, ^ask.original_authors, @whole),
        publishers: excerpt(p.publishers, ^ask.publishers, @whole),
        countries: excerpt(p.countries, ^ask.countries, @whole),
        references:
          excerpt(
            fragment("array_to_string(?, ' ')", p.references),
            ^ask.references,
            @window
          )
      }
    })
  end

  # A spelled-out term is read by Postgres rather than parsed here, and resolves
  # to no words, so Postgres is asked for the tsquery it reads the term as and
  # every field is excerpted with that.
  defp spelled_out_ask(term) do
    %{rows: [[query]]} = Repo.query!("SELECT websearch_to_tsquery('rb_search', $1)::text", [term])

    Map.new(@fields, &{&1, query})
  end

  # The free words are asked of every field; a filter only of the field it named,
  # so a term of operators alone excerpts nothing outside them.
  defp parsed_ask(alternatives) do
    words = alternatives |> Enum.flat_map(& &1.words) |> Enum.map(&word_query/1) |> any_of()
    filters = alternatives |> Enum.flat_map(& &1.filters) |> Enum.reduce(%{}, &filter/2)

    Map.new(@fields, &{&1, any_of([words, filters[&1]])})
  end

  # A filter marks the words of its value in the field it named. A negated one
  # marks nothing: the reader asked not to see it, so it cannot be why a row is
  # here. `year` names a number, which has nothing to mark.
  defp filter(%{negated: true}, ask), do: ask
  defp filter(%{field: :year}, ask), do: ask

  defp filter(%{field: field, value: value, exact: exact}, ask) do
    query = value_query(value, exact)
    Map.update(ask, field, query, &any_of([&1, query]))
  end

  # A quoted value was matched as the phrase it is, so it marks the words it
  # actually holds. Anything else marks word by word, as a free word does.
  defp value_query(value, true),
    do: value |> Keywords.words() |> Enum.map(&Query.lexeme/1) |> any_of()

  defp value_query(value, false),
    do: value |> Keywords.words() |> Enum.map(&word_query/1) |> any_of()

  # A word marks what the search matched it as: what it begins, or, when it
  # begins nothing in the index, what it resembles — the same ladder the search
  # itself climbed, so a misspelling still marks what it found.
  defp word_query(word) do
    case Keywords.standing_for(word) do
      {:prefix, _words} -> "#{Query.lexeme(word)}:*"
      {:fuzzy, words} -> words |> Enum.map(&Query.lexeme/1) |> any_of()
    end
  end

  # Marking asks whether a word is there at all, not whether every word is, so
  # the parts are combined with `|`: a field carrying any of them is excerpted at
  # it. Nothing to ask is nil, which matches nothing.
  defp any_of(queries) do
    case Enum.reject(queries, &(&1 in [nil, ""])) do
      [] -> nil
      queries -> Enum.map_join(queries, " | ", &"(#{&1})")
    end
  end
end
