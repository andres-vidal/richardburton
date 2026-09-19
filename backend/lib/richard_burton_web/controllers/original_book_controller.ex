defmodule RichardBurtonWeb.OriginalBookController do
  @moduledoc """
  The original-book lookup that backs the editor's autocomplete, returning a book
  whole — title and authors together — so selecting one fills both.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.OriginalBook

  def index(conn, %{"search" => query}) do
    json(conn, Enum.map(OriginalBook.search(query), &OriginalBook.flatten/1))
  end

  def index(conn, _params) do
    json(conn, Enum.map(OriginalBook.all(), &OriginalBook.flatten/1))
  end
end
