defmodule RichardBurtonWeb.Plugs.Authenticate.Bearer do
  @moduledoc """
  Authenticates a request via an identity-provider token in the
  `Authorization: Bearer` header (see `RichardBurton.Auth`) and assigns
  `:subject_id` and `:email`. Used by the login endpoints that exchange the
  provider token for a session.

  The email is assigned from the verified token, not read from the request, so
  what the account is keyed on is the provider's word rather than the caller's.
  """
  alias RichardBurton.Auth

  import Plug.Conn

  def init(params), do: params

  def call(conn, _params) do
    case verify(conn) do
      {:ok, %{subject_id: subject_id, email: email}} ->
        conn |> assign(:subject_id, subject_id) |> assign(:email, email)

      :error ->
        halt_unauthorized(conn)
    end
  end

  defp verify(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> Auth.verify(token)
      _ -> :error
    end
  end

  defp halt_unauthorized(conn) do
    conn |> send_resp(:unauthorized, "Unauthorized") |> halt()
  end
end
