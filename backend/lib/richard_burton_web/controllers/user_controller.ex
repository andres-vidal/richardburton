defmodule RichardBurtonWeb.UserController do
  use RichardBurtonWeb, :controller

  alias RichardBurton.Auth.Session
  alias RichardBurton.User

  @doc """
  Returns the current user for a valid `rb-session` cookie, or `null`. Public
  (reads the cookie itself) so the SPA can poll auth state without a 401.
  """
  def me(conn, _params) do
    with token when is_binary(token) <- fetch_cookies(conn).cookies[Session.cookie_name()],
         {:ok, subject_id} <- Session.verify(token) do
      json(conn, User.get(subject_id))
    else
      _ -> json(conn, nil)
    end
  end

  @doc """
  Upserts the user for the verified provider subject (assigned by the bearer
  plug). Login itself goes through `POST /sessions`; this endpoint is kept for
  the planned admin user-management dashboard (see roadmap 12).
  """
  def create(conn = %{assigns: %{subject_id: subject_id}}, attrs) do
    case User.insert(Map.put(attrs, "subject_id", subject_id)) do
      {:ok, user} -> conn |> put_status(:created) |> json(user)
      {:error, :conflict} -> conn |> put_status(:conflict) |> json(User.get(subject_id))
      {:error, _} -> conn |> put_status(:bad_request) |> json(nil)
    end
  end

  def create(conn) do
    conn |> put_status(:unauthorized) |> json("Unauthorized")
  end
end
