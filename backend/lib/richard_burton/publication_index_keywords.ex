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
  The indexed words a whole term matches.

  Each word is resolved on its own: by prefix, or by resemblance when it
  prefixes nothing. A word matching no indexed word is left out, so one
  unmatched word does not empty the result.
  """
  def naming(term) when is_binary(term) do
    term
    |> words()
    |> Enum.flat_map(&naming_word/1)
    |> Enum.uniq()
  end

  @doc "A term as the words it is made of."
  def words(term), do: String.split(term, ~r/\s+/, trim: true)

  # Those the word prefixes, or those it resembles when it prefixes none.
  defp naming_word(word) do
    case resolve(word, :prefix) do
      [] -> resolve(word, :fuzzy)
      keywords -> keywords
    end
  end
end
