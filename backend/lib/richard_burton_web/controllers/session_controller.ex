defmodule RichardBurtonWeb.SessionController do
  @moduledoc """
  Exchanges a verified identity-provider token for the app's own session cookie.

  The `Authenticate` plug has already verified the incoming provider token and
  assigned the identity it vouches for; this action upserts the user and sets
  the `rb-session` cookie so subsequent requests authenticate without forwarding
  the provider token.

  The account is keyed on the assigned subject and email — never on the request
  body, which the caller controls and which an invitation would otherwise let
  them turn into a role.
  """
  use RichardBurtonWeb, :controller

  alias RichardBurton.Auth.Session
  alias RichardBurton.Invitation
  alias RichardBurtonWeb.SignInCookies

  def create(conn = %{assigns: %{subject_id: subject_id, email: email}}, _attrs) do
    case Invitation.admit(subject_id, email) do
      {:ok, user} ->
        conn |> SignInCookies.put(subject_id) |> put_status(:ok) |> json(user)

      :not_invited ->
        {:error, :forbidden, :not_invited}

      {:error, _} ->
        conn |> put_status(:bad_request) |> json(nil)
    end
  end

  def create(conn, _attrs) do
    conn |> put_status(:unauthorized) |> json("Unauthorized")
  end

  @doc """
  Clears the `rb-session` cookie so the browser is signed out. The cookie is
  http-only, so only a server response can expire it; no auth is required since
  clearing one's own cookie is harmless.
  """
  def delete(conn, _params) do
    conn = fetch_cookies(conn)

    # `Session.revoke/1` broadcasts the change of access, and the document
    # channels opened under this session close. See `RichardBurton.Auth.Access`.
    case conn.cookies[Session.cookie_name()] do
      nil -> :ok
      token -> Session.revoke(token)
    end

    conn
    |> SignInCookies.delete()
    |> send_resp(:no_content, "")
  end
end
