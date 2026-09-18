defmodule RichardBurton.Publication.Index.Keywords do
  @moduledoc """
  Resolves the words a reader typed to the words the index actually holds.

  `search_keywords` is a materialized view of every distinct word in the search
  documents. A term is matched against it word by word, because both kinds of
  match only work that way: a prefix is the start of a single word, and trigram
  similarity between a word and a whole phrase falls toward zero as the phrase
  grows.

  Two modes, which the caller chooses:

    * `:prefix` — the indexed words a word begins, for a term matched as typed.
    * `:fuzzy` — the indexed words a word resembles, for the second pass when
      nothing matched as typed.
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
      where: fragment("similarity((?), unaccent(?)) > ?", w.word, ^word, ^@similarity)
    )
    |> Repo.all()
    |> Enum.map(& &1.word)
  end

  @doc """
  The indexed words a word stands for, and how it reached them: those it begins,
  or those it resembles when it begins none.

  The same ladder a search climbs, so what a reader is told the index made of
  their word is what it marked on the rows.
  """
  def standing_for(word) do
    case resolve(word, :prefix) do
      [] -> {:fuzzy, resolve(word, :fuzzy)}
      prefixed -> {:prefix, prefixed}
    end
  end

  @doc """
  A term as the words it is made of.

  ## Examples

      iex> RichardBurton.Publication.Index.Keywords.words("dom casmurro")
      ["dom", "casmurro"]

      iex> RichardBurton.Publication.Index.Keywords.words("  dom   casmurro  ")
      ["dom", "casmurro"]
  """
  def words(term), do: String.split(term, ~r/\s+/, trim: true)
end
