defmodule RichardBurton.Publication.Index.KeywordsTest do
  @moduledoc """
  Tests for splitting a term into the words the index is asked about.

  `resolve/2` reads the keyword view, so it is covered where a search exercises
  it, in `RichardBurton.Publication.IndexTest`.
  """

  use ExUnit.Case, async: true

  doctest RichardBurton.Publication.Index.Keywords
end
