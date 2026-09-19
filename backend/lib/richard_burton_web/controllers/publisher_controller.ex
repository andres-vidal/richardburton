defmodule RichardBurtonWeb.PublisherController do
  @moduledoc """
  The publisher lookup that backs the editor's autocomplete: every publisher, or
  those matching a search term.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.Publisher

  def index(conn, %{"search" => query}) do
    json(conn, Enum.map(Publisher.search(query), &Map.get(&1, :name)))
  end

  def index(conn, _params) do
    json(conn, Enum.map(Publisher.all(), &Map.get(&1, :name)))
  end
end
