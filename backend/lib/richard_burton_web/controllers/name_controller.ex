defmodule RichardBurtonWeb.NameController do
  @moduledoc """
  Lists the names of the records of one schema with a `name` field, such as
  `RichardBurton.Author` or `RichardBurton.Publisher`. The route names the
  schema in its `:assigns`, as `schema`.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.Name
  alias RichardBurton.Repo

  @doc """
  Responds with the names that `RichardBurton.Name.search/2` finds for the
  `search` parameter, or with every name when there is no search.
  """
  def index(conn = %{assigns: %{schema: schema}}, params) do
    records =
      case params do
        %{"search" => term} -> Name.search(schema, term)
        _ -> Repo.all(schema)
      end

    json(conn, Name.flatten(records))
  end
end
