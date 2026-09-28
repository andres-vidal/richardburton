defmodule RichardBurtonWeb.UserController do
  @moduledoc """
  Who may work on the database: the signed-in subject, the list of accounts, and
  the admin writes that change or revoke a role.

  The platform refuses to be left without an administrator, and nobody may
  change their own role.
  """

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

  @doc "Everyone with access, and what they may do."
  def index(conn, _params) do
    json(conn, User.all())
  end

  @doc """
  Change what a user may do.

  The last admin cannot be demoted: the platform would be left with nobody who
  can grant access, and no way back except the database.
  """
  def update(conn = %{assigns: %{subject_id: subject_id}}, %{"id" => id, "role" => role}) do
    with {:ok, user} <- found(User.get_by_id(id)),
         {:ok, updated} <- User.set_role(user, role, subject_id) do
      json(conn, updated)
    end
  end

  @doc "Revoke someone's access, and the sessions signed in as them."
  def delete(conn = %{assigns: %{subject_id: subject_id}}, %{"id" => id}) do
    with {:ok, user} <- found(User.get_by_id(id)),
         {:ok, _deleted} <- User.delete(user, subject_id) do
      send_resp(conn, :no_content, "")
    end
  end
end
