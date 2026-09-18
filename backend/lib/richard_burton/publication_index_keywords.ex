defmodule RichardBurton.Publication.Index.Keywords do
  @moduledoc """
  Maps the words someone typed onto the words the index actually contains.

  `search_keywords` is a materialized view holding every distinct word in the
  search documents. Terms are matched against it one word at a time, because
  neither kind of match works on anything longer: a prefix is the beginning of a
  single word, and trigram similarity between a word and a whole phrase drops
  towards zero as the phrase gets longer.

  The caller picks one of two modes:

    * `:prefix` — the indexed words that start with the given word. Used when
      matching a term as typed.
    * `:fuzzy` — the indexed words that merely resemble it. Used for the second
      attempt, after nothing matched as typed.
  """

  import Ecto.Query

  alias RichardBurton.Publication.Index.SearchKeyword
  alias RichardBurton.Repo

  @similarity 0.3

  @doc """
  The indexed words a single word stands for, in the given mode.

  The index holds words with their accents folded away, so the word is folded
  the same way before it is compared to them.
  """
  def resolve(word, :prefix) do
    from(w in SearchKeyword, where: ilike(w.word, fragment("unaccent(?)", ^"#{word}%")))
    |> Repo.all()
    |> Enum.map(& &1.word)
  end

  def resolve(word, :fuzzy) do
    from(w in SearchKeyword,
      where: fragment("similarity((?), unaccent(?)) > ?", w.word, ^word, ^@similarity),
      # Most similar first. All of them are searched on regardless, so this does
      # not affect which publications match, only the order they come back in.
      order_by: [desc: fragment("similarity((?), unaccent(?))", w.word, ^word)]
    )
    |> Repo.all()
    |> Enum.map(& &1.word)
  end

  @doc """
  The indexed words a given word matches, and how it matched them: the words it
  is a prefix of, or the words it resembles if it is a prefix of none.
  """
  def standing_for(word) do
    case resolve(word, :prefix) do
      [] -> {:fuzzy, resolve(word, :fuzzy)}
      prefixed -> {:prefix, prefixed}
    end
  end

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
