defmodule RichardBurtonWeb.SessionController do
  @moduledoc """
  Signs in with an identity-provider token, and signs out.

  Signing in admits the person the `Authenticate.Bearer` plug assigned, through
  `RichardBurton.Invitation.admit/2`, and sets the cookies of
  `RichardBurtonWeb.SignInCookies`. The account is looked up by the assigned
  subject and email, never by the request body, because the body is chosen by
  the caller and the email decides which invitation, and so which role, is
  taken up.
  """
  use RichardBurtonWeb, :controller

  alias RichardBurton.Auth.Session
  alias RichardBurton.Invitation
  alias RichardBurtonWeb.SignInCookies

  @doc """
  Admits the assigned identity, sets the sign-in cookies and responds with the
  user. An address that nobody invited is a 403 with `not_invited`, and a
  request without an assigned identity is a 401 with `unauthorized`.
  """
  def create(conn = %{assigns: %{subject_id: subject_id, email: email}}, _params) do
    case Invitation.admit(subject_id, email) do
      {:ok, user} -> conn |> SignInCookies.put(subject_id) |> json(user)
      :not_invited -> {:error, :forbidden, :not_invited}
      error -> error
    end
  end

  def create(_conn, _params), do: {:error, :unauthorized, :unauthorized}

  @doc """
  Revokes the session in the `rb-session` cookie, when there is one, and
  deletes the sign-in cookies. `Session.revoke/1` announces the change of
  access, so the document channels joined under the session close.

  It needs no authentication, because it only ends the session the request
  itself carries.
  """
  def delete(conn, _params) do
    conn = fetch_cookies(conn)

    case conn.cookies[Session.cookie_name()] do
      nil -> :ok
      token -> Session.revoke(token)
    end

    conn
    |> SignInCookies.delete()
    |> send_resp(:no_content, "")
  end
end
