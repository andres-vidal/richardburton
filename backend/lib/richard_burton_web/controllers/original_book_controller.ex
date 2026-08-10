defmodule RichardBurtonWeb.OriginalBookController do
  use RichardBurtonWeb, :controller

  alias RichardBurton.OriginalBook

  def index(conn, %{"search" => query}) do
    json(conn, Enum.map(OriginalBook.search(query), &OriginalBook.flatten/1))
  end

  def index(conn, _params) do
    json(conn, Enum.map(OriginalBook.all(), &OriginalBook.flatten/1))
  end
end
