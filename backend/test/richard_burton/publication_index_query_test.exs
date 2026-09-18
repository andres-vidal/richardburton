defmodule RichardBurton.Publication.Index.QueryTest do
  @moduledoc """
  Tests for writing a word as a tsquery lexeme.

  The rest of the module returns Ecto expressions, which say nothing on their
  own; they are covered where a search runs them, in
  `RichardBurton.Publication.IndexTest`.
  """

  use ExUnit.Case, async: true

  alias RichardBurton.Publication.Index.Query

  doctest RichardBurton.Publication.Index.Query

  test "a trailing backslash is escaped, not left to eat the closing quote" do
    # `'caldwell\'` would leave Postgres a tsquery it cannot parse, and the
    # search 500s on a term a reader can easily type.
    assert Query.lexeme("caldwell\\") == ~S('caldwell\\')
  end
end
