defmodule RichardBurtonWeb.Plugs.IgnoreBlankSearch do
  @moduledoc """
  Removes a `search` parameter that holds nothing but whitespace, so the
  request is answered as if it had no search.

  The index answers an empty search with no publications, and a missing search
  with all of them. Removing a blank search here gives every action that reads
  the parameter the second answer.
  """
  @behaviour Plug

  @impl true
  def init(params), do: params

  @impl true
  def call(conn = %{params: %{"search" => search}}, _params) when is_binary(search) do
    case String.trim(search) do
      "" -> %{conn | params: Map.delete(conn.params, "search")}
      _ -> conn
    end
  end

  def call(conn, _params), do: conn
end
