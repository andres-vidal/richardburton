defmodule RichardBurton.Publication.Index.Keywords do
  @moduledoc """
  Maps the words someone typed onto the words the index actually contains.

  `search_keywords` is a materialized view holding every distinct word in the
  search documents. Terms are matched against it one word at a time, because
  neither kind of match works on anything longer: a prefix is the beginning of a
  single word, and trigram similarity between a word and a whole phrase drops
  towards zero as the phrase gets longer.

  A word's **standing** is how it matched the indexed words, and which ones it
  matched. It is one of two tuples:

    * `{:prefix, words}` — the indexed words that start with the word as typed.
      A word stands this way when at least one indexed word starts with it.
    * `{:fuzzy, words}` — the indexed words that resemble the word, most similar
      first. A word stands this way when no indexed word starts with it, and
      `words` is empty when none resembles it either.
  """

  alias RichardBurton.Repo

  @typedoc "How a word matched the indexed words, as the module doc describes."
  @type standing :: {:prefix, [String.t()]} | {:fuzzy, [String.t()]}

  # The trigram similarity above which an indexed word resembles a typed one.
  @similarity 0.3

  # Finds the standing of each word in the array `$1`, with `$2` as the
  # similarity threshold. Returns one row per distinct word: the word, the
  # standing's kind, and the indexed words. The index holds words with their
  # accents folded away, so each word is folded the same way before it is
  # compared to them.
  #
  # Prefix matches keep the order the database returns them in. Fuzzy matches
  # are ordered most similar first. `%` is `similarity >= the
  # pg_trgm.similarity_threshold setting`, which the trigram index can answer.
  # The explicit `similarity > $2` keeps the threshold exclusive.
  @standings """
  WITH typed AS (
    SELECT DISTINCT word FROM unnest($1::text[]) AS t(word)
  ),
  prefixed AS (
    SELECT t.word, array_agg(k.word) AS words
    FROM typed t
    JOIN search_keywords k ON k.word ILIKE unaccent(t.word || '%')
    GROUP BY t.word
  )
  SELECT word, 'prefix', words FROM prefixed
  UNION ALL
  SELECT
    t.word,
    'fuzzy',
    coalesce(
      array_agg(k.word ORDER BY similarity(k.word, unaccent(t.word)) DESC)
        FILTER (WHERE k.word IS NOT NULL),
      '{}'
    )
  FROM typed t
  LEFT JOIN search_keywords k
    ON k.word % unaccent(t.word) AND similarity(k.word, unaccent(t.word)) > $2
  WHERE t.word NOT IN (SELECT word FROM prefixed)
  GROUP BY t.word
  """

  @doc """
  Returns the standing of each of `words`, keyed by the word, looked up with one
  query. An empty list looks nothing up.
  """
  @spec standings([String.t()]) :: %{String.t() => standing}
  def standings([]), do: %{}

  def standings(words) do
    {:ok, %{rows: rows}} =
      Repo.transaction(fn ->
        Repo.query!(
          "SELECT set_config('pg_trgm.similarity_threshold', $1, true)",
          [to_string(@similarity)]
        )

        Repo.query!(@standings, [Enum.uniq(words), @similarity])
      end)

    Map.new(rows, fn [word, kind, matched] -> {word, {kind(kind), matched}} end)
  end

  # The kind of standing a row of the query names.
  defp kind("prefix"), do: :prefix
  defp kind("fuzzy"), do: :fuzzy

  @doc """
  Splits a term into the individual words it is made of.

  ## Examples

      iex> RichardBurton.Publication.Index.Keywords.words("dom casmurro")
      ["dom", "casmurro"]

      iex> RichardBurton.Publication.Index.Keywords.words("  dom   casmurro  ")
      ["dom", "casmurro"]
  """
  def words(term), do: String.split(term, ~r/\s+/, trim: true)
end
