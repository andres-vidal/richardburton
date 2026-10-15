defmodule RichardBurtonWeb.Refusal do
  @moduledoc """
  Answers a request with an error status and the JSON body `%{error: reason}`,
  and halts the connection so that no later plug or action runs.

  The status says what kind of refusal it is. A 401 means that the request
  carries no credentials, or credentials that do not verify. A request whose
  credentials are valid but which is refused all the same, for a missing role or
  a failed check, gets a 403. The reason names what was refused.
  """

  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  @doc """
  Sends `status` with the JSON body `%{error: reason}`, and halts `conn`.
  """
  @spec refuse(Plug.Conn.t(), atom(), atom()) :: Plug.Conn.t()
  def refuse(conn, status, reason) do
    conn |> put_status(status) |> json(%{error: reason}) |> halt()
  end
end
