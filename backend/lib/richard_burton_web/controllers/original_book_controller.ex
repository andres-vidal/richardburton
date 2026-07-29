defmodule RichardBurtonWeb.OriginalBookController do
  use RichardBurtonWeb, :controller

  alias RichardBurton.Author
  alias RichardBurton.OriginalBook

  def index(conn, %{"search" => query}) do
    json(conn, Enum.map(OriginalBook.search(query), &flatten/1))
  end

  def index(conn, _params) do
    json(conn, Enum.map(OriginalBook.all(), &flatten/1))
  end

  # A book as the form speaks of it: a title, and its authors as the one comma
  # separated string the field holds.
  defp flatten(book) do
    %{title: book.title, authors: Author.flatten(book.authors)}
  end
end
