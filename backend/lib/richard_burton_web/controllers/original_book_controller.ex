defmodule RichardBurtonWeb.OriginalBookController do
  @moduledoc """
  Lists the original books, each with its title and its authors' names.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.OriginalBook

  @doc """
  Responds with the books that `RichardBurton.OriginalBook.search/1` finds for
  the `search` parameter, by title or by author, or with every book when there
  is no search. Each book is flattened by `RichardBurton.OriginalBook.flatten/1`.
  """
  def index(conn, %{"search" => query}) do
    json(conn, Enum.map(OriginalBook.search(query), &OriginalBook.flatten/1))
  end

  def index(conn, _params) do
    json(conn, Enum.map(OriginalBook.all(), &OriginalBook.flatten/1))
  end
end
