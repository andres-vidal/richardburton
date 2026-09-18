defmodule RichardBurton.Publication.Index.Excerpt do
  @moduledoc """
  Builds the highlighted text that shows why a publication matched a search.

  A search result tells you which publications matched, but not what in them
  matched. This asks Postgres for that: for each field, the part of its text
  that the search matched, with the matched words wrapped in `[[ ]]`. The result
  goes in the row's virtual `excerpts` map, keyed by field, and is `nil` for any
  field the search did not match.

  The highlighting is produced by the same query that decides the match, because
  only the database holds what is needed to place it. It knows which spellings
  the search configuration treats as the same word and where one word ends, and
  it knows which field each part of the term applied to. `title:night` has to
  highlight the title and nothing else, and a list of matched words that does
  not record which field each was searched in cannot express that.

  Terms used here:

    * **excerpt** — the matching text of one field. Short fields come back in
      full. `references` is an array, which the search treats as one long
      string, so it comes back as a short window around the match instead.
    * **widening** — one word that the search matched with something other than
      what was typed, either because the word is a prefix of several indexed
      words or because it matched none and fell back to ones resembling it. A
      word matched exactly is not a widening, and is not reported. See
      `resolution/1`.
  """

  import Ecto.Query

  alias RichardBurton.Publication.Index.Keywords
  alias RichardBurton.Publication.Index.Query
  alias RichardBurton.Publication.Index.Term
  alias RichardBurton.Repo

  @typedoc """
  One word the search matched with something other than what was typed: the word
  as typed, the indexed words it matched, and the field it was searched in. The
  field is nil for a free word, which is searched in every field.
  """
  @type widening :: %{field: String.t() | nil, typed: String.t(), words: [String.t()]}

  # Highlighting options for `ts_headline`. Short fields are returned in full.
  # `references` holds a whole bibliography joined into one string, so only a
  # short window around the match is returned.
  @whole "StartSel=[[,StopSel=]],HighlightAll=true"
  @window "StartSel=[[,StopSel=]],MaxFragments=1,MaxWords=16,MinWords=6"

  # The fields that get an excerpt. These are the fields the search document is
  # built from, less two. `year` is a number and has no text to highlight.
  # `countries` holds a country code while the search document holds the
  # country's names, so an excerpt on that column would mark the code, which is
  # not the text the search matched.
  @fields [
    :title,
    :original_title,
    :authors,
    :original_authors,
    :publishers,
    :references
  ]

  # Builds one field's excerpt, or nil. When the field has no tsquery, `to_tsquery`
  # receives nil, nothing matches, and the CASE yields nil. This is a macro
  # because a fragment's SQL must be a literal string, so it cannot be built in a
  # loop over the fields.
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
  Lists the words the search matched with something other than what was typed.

  Each entry gives the word as it was typed, the indexed words it actually
  matched, and the field it was searched in. The field is `nil` for a free word,
  which is searched in every field. Entries come back in the order the words were
  typed.

  Words the search matched exactly are left out, since reporting that `machado`
  matched `machado` adds nothing. What is worth reporting is that `Maries`
  matched `marias`, `marie` and `mario`, because those results correspond to no
  word in the term as it was written.

  This uses the same word resolution the excerpts use, so the words reported here
  are exactly the words highlighted in the rows. Two cases return nothing: a
  quoted value, which is matched exactly and so is never widened, and a term
  Postgres parses itself (see `RichardBurton.Publication.Index.Query`).
  """
  @spec resolution(String.t()) :: [widening]
  def resolution(term) do
    alternatives = Term.parse(term)

    if Term.plain?(alternatives) and Query.spelled_out?(term),
      do: [],
      else: free_widenings(alternatives) ++ scoped_widenings(alternatives)
  end

  # The widenings among the free words, meaning the ones not attached to an
  # operator, which are searched in every field.
  defp free_widenings(alternatives) do
    alternatives |> Enum.flat_map(& &1.words) |> Enum.flat_map(&widening(nil, &1))
  end

  # The widenings among the words of each operator's value, reported under the name
  # the operator is written with so the entry can be written back into a term.
  # Three kinds are skipped: a negated operator excludes rather than matches, a
  # `year` contains no words, and a quoted value is matched exactly.
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

  # Reports a word only if the index matched it with something other than itself:
  # either it found nothing spelled that way and fell back to similar words, or
  # the word is a prefix of more than one indexed word. A word that matches only
  # itself, and a word the index does not contain at all, are both left out.
  defp widening(field, word) do
    case Keywords.standing_for(word) do
      {_how, []} -> []
      {:prefix, [only]} -> if Term.fold(word) == only, do: [], else: report(field, word, [only])
      {_how, words} -> report(field, word, words)
    end
  end

  # Wraps a word and what it matched into a widening. The words arrive
  # most-similar-first from the index and keep that order.
  defp report(field, word, words), do: [%{field: field, typed: word, words: words}]

  @doc """
  Adds the `excerpts` map to a query, one excerpt per field.

  The term is read from scratch here, the same way the search read it, so this
  needs nothing but the term itself. None of what the search resolved earlier has
  to be carried along. A field that no part of the term searched gets no tsquery,
  and so gets no excerpt.
  """
  @spec select(Ecto.Query.t(), String.t()) :: Ecto.Query.t()
  def select(query, term) do
    queries = field_queries(term)

    select_merge(query, [p], %{
      excerpts: %{
        title: excerpt(p.title, ^queries.title, @whole),
        original_title: excerpt(p.original_title, ^queries.original_title, @whole),
        authors: excerpt(p.authors, ^queries.authors, @whole),
        original_authors: excerpt(p.original_authors, ^queries.original_authors, @whole),
        publishers: excerpt(p.publishers, ^queries.publishers, @whole),
        references:
          excerpt(
            fragment("array_to_string(?, ' ')", p.references),
            ^queries.references,
            @window
          )
      }
    })
  end

  # The tsquery to highlight each field with, or nil for a field nothing searched.
  defp field_queries(term) do
    alternatives = Term.parse(term)

    if Term.plain?(alternatives) and Query.spelled_out?(term),
      do: spelled_out_queries(term),
      else: parsed_queries(alternatives)
  end

  # The tsquery to highlight every field with, for a term Postgres parses rather
  # than us. No words are resolved here in that case, so Postgres is asked what
  # tsquery it reads the term as.
  defp spelled_out_queries(term) do
    %{rows: [[query]]} = Repo.query!("SELECT websearch_to_tsquery('rb_search', $1)::text", [term])

    Map.new(@fields, &{&1, query})
  end

  # The tsquery per field for a parsed term. Free words are searched in every
  # field; an operator's value only in the field it names, so a term made only of
  # operators highlights nothing outside those fields.
  defp parsed_queries(alternatives) do
    words = alternatives |> Enum.flat_map(& &1.words) |> Enum.map(&Query.word_query/1) |> any_of()
    filters = alternatives |> Enum.flat_map(& &1.filters) |> Enum.reduce(%{}, &filter/2)

    Map.new(@fields, &{&1, any_of([words, filters[&1]])})
  end

  # Adds an operator's value under the field it names. Negated operators are
  # skipped, since the reader asked not to see those words and they cannot be why a
  # row matched, and `year` is skipped for being a number with no text to
  # highlight.
  defp filter(%{negated: true}, acc), do: acc
  defp filter(%{field: :year}, acc), do: acc

  defp filter(%{field: field, value: value, exact: exact}, acc) do
    query = value_query(value, exact)
    Map.update(acc, field, query, &any_of([&1, query]))
  end

  # A quoted value was matched as an exact phrase, so it highlights exactly the
  # words it contains. An unquoted value is highlighted word by word, the same
  # way a free word is.
  defp value_query(value, true),
    do: value |> Keywords.words() |> Enum.map(&Query.lexeme/1) |> any_of()

  defp value_query(value, false),
    do: value |> Keywords.words() |> Enum.map(&Query.word_query/1) |> any_of()

  # Combines tsqueries with `|` rather than `&`: highlighting asks whether any of
  # these words appears in the field, not whether all of them do. Returns nil when
  # there is nothing to search for, which highlights nothing.
  defp any_of(queries) do
    case Enum.reject(queries, &(&1 in [nil, ""])) do
      [] -> nil
      queries -> Enum.map_join(queries, " | ", &"(#{&1})")
    end
  end
end
