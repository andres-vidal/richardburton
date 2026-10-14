defmodule RichardBurtonWeb.InsightsController do
  @moduledoc """
  Returns the counts from `RichardBurton.Publication.Insights.describe/2` for
  every publication in the index, or for the ones the `search` parameter
  matches. The search is parsed the same way as an index search.

  The other parameters describe the chart, as
  `RichardBurton.Publication.Chart.parse/1` reads them. A parameter that is not
  valid is a 400 that names it.

  The response also has a `matched` key. With a search, it holds
  `Publication.Index.Excerpt.resolution/1` for the search: the words the search
  matched with something other than what was typed. Without a search, it is
  `nil`.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.Publication

  def show(conn, params) do
    search = Map.get(params, "search")

    with {:ok, chart} <- Publication.Chart.parse(params) do
      json(
        conn,
        Map.put(
          Publication.Insights.describe(search, chart),
          :matched,
          search && Publication.Index.Excerpt.resolution(search)
        )
      )
    end
  end
end
