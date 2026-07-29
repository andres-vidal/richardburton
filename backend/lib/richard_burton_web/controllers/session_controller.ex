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

  alias RichardBurton.Auth.Csrf
  alias RichardBurton.Auth.Session
  alias RichardBurton.Invitation

  def create(conn = %{assigns: %{subject_id: subject_id, email: email}}, _attrs) do
    case Invitation.admit(subject_id, email) do
      {:ok, user} ->
        conn |> put_session_cookie(subject_id) |> put_status(:ok) |> json(user)

      :not_invited ->
        conn |> put_status(:forbidden) |> json(%{error: :not_invited})

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

    case conn.cookies[Session.cookie_name()] do
      nil -> :ok
      token -> Session.revoke(token)
    end

    conn
    |> delete_resp_cookie(Session.cookie_name(), same_site: "Lax", secure: secure_cookie?())
    |> delete_resp_cookie("csrf-token",
      same_site: "Lax",
      secure: secure_cookie?(),
      http_only: false
    )
    |> send_resp(:no_content, "")
  end

  # Sets the httpOnly `rb-session` cookie plus the readable `csrf-token` cookie
  # the browser echoes back in the `rb-csrf-token` header (see Auth.Csrf).
  defp put_session_cookie(conn, subject_id) do
    {:ok, token} = Session.create(subject_id)

    conn
    |> put_resp_cookie(Session.cookie_name(), token,
      http_only: true,
      same_site: "Lax",
      secure: secure_cookie?(),
      max_age: Session.max_age()
    )
    |> put_resp_cookie("csrf-token", Csrf.sign(subject_id),
      http_only: false,
      same_site: "Lax",
      secure: secure_cookie?(),
      max_age: Session.max_age()
    )
  end

  defp secure_cookie?, do: Application.get_env(:richard_burton, :phx_session_tls, true)
end
