defmodule RichardBurton.Publication.Index.KeywordsTest do
  @moduledoc """
  Tests for splitting a term into the words the index is asked about.

  `standings/1` reads the keyword view, so it is tested with a seeded index, in
  `RichardBurton.Publication.IndexTest`.
  """

  use ExUnit.Case, async: true

  doctest RichardBurton.Publication.Index.Keywords
end
