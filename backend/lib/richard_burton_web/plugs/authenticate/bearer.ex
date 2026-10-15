defmodule RichardBurtonWeb.Plugs.Authenticate.Bearer do
  @moduledoc """
  Authenticates a request by the identity-provider token in its
  `Authorization: Bearer` header (see `RichardBurton.Auth`), and assigns the
  `:subject_id` and `:email` the token vouches for.

  The email is assigned from the verified token, not read from the request, so
  an account is looked up by the provider's address rather than the caller's.

  A request without the header, or with a token that does not verify, is
  refused with a 401 and the reason `unauthorized`. The response does not say
  which of the two it was.
  """
  @behaviour Plug

  alias RichardBurton.Auth

  import Plug.Conn
  import RichardBurtonWeb.Refusal

  @impl true
  def init(params), do: params

  @impl true
  def call(conn, _params) do
    case verify(conn) do
      {:ok, %{subject_id: subject_id, email: email}} ->
        conn |> assign(:subject_id, subject_id) |> assign(:email, email)

      :error ->
        refuse(conn, :unauthorized, :unauthorized)
    end
  end

  # Returns what `Auth.verify/1` returns for the bearer token, or `:error` when
  # the request has no bearer token.
  defp verify(conn) do
    case get_req_header(conn, "authorization") do
      ["Bearer " <> token] -> Auth.verify(token)
      _ -> :error
    end
  end
end
