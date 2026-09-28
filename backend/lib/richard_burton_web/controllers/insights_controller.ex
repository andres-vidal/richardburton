defmodule RichardBurtonWeb.InsightsController do
  @moduledoc """
  The counts that describe the publications in the index, for all of them or
  for the ones a search matches. See `RichardBurton.Publication.Insights`.

  A search is read the way the index reads it, and the response says how it was
  read under `matched`, as the index's first page does.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.Publication

  def show(conn, params) do
    search = Map.get(params, "search")

    json(
      conn,
      Map.put(
        Publication.Insights.describe(search),
        :matched,
        search && Publication.Index.Excerpt.resolution(search)
      )
    )
  end
end
