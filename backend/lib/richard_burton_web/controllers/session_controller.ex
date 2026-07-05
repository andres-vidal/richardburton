defmodule RichardBurtonWeb.SessionController do
  @moduledoc """
  Exchanges a verified identity-provider token for the app's own session cookie.

  The `Authenticate` plug has already verified the incoming provider token and
  assigned `:subject_id`; this action upserts the user and sets the `rb-session`
  cookie so subsequent requests authenticate without forwarding the provider
  token.
  """
  use RichardBurtonWeb, :controller

  alias RichardBurton.Auth.Session
  alias RichardBurton.User

  def create(conn = %{assigns: %{subject_id: subject_id}}, attrs) do
    case User.insert(Map.put(attrs, "subject_id", subject_id)) do
      {:ok, user} ->
        conn |> put_session_cookie(subject_id) |> put_status(:created) |> json(user)

      {:error, :conflict} ->
        conn |> put_session_cookie(subject_id) |> put_status(:ok) |> json(User.get(subject_id))

      {:error, _} ->
        conn |> put_status(:bad_request) |> json(nil)
    end
  end

  def create(conn, _attrs) do
    conn |> put_status(:unauthorized) |> json("Unauthorized")
  end

  defp put_session_cookie(conn, subject_id) do
    put_resp_cookie(conn, "rb-session", Session.sign(subject_id),
      http_only: true,
      same_site: "Lax",
      secure: Application.get_env(:richard_burton, :phx_session_tls, true),
      max_age: Session.max_age()
    )
  end
end
