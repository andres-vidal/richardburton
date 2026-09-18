defmodule RichardBurtonWeb.Plugs.IgnoreBlankSearch do
  @moduledoc """
  Removes a `search` parameter holding nothing but whitespace, so that the
  request is answered as though it carried no search at all.

  An empty term matches nothing and an absent one asks for everything, so the two
  answers are opposites rather than neighbours. A caller that builds its query
  string from an empty input would get an empty database back, which is why every
  such caller otherwise has to remember to leave the parameter out. This removes
  it once, for every action that reads one.
  """

  def init(params), do: params

  def call(conn = %{params: %{"search" => search}}, _params) when is_binary(search) do
    case String.trim(search) do
      "" -> %{conn | params: Map.delete(conn.params, "search")}
      _ -> conn
    end
  end

  def call(conn, _params), do: conn
end
