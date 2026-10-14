defmodule RichardBurtonWeb.UserController do
  @moduledoc """
  Reads the signed-in user, lists the users, and changes or removes a user's
  access.

  The writes refuse to leave the platform without an admin, and refuse to
  change the role of the user who asks. See `RichardBurton.User.set_role/3`
  and `RichardBurton.User.delete/2`.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.Auth.Session
  alias RichardBurton.User
  alias RichardBurtonWeb.Plugs.Authenticate

  @doc """
  Responds with the user the `rb-session` cookie is signed in as, or with
  `null` when there is no valid session. The route needs no authentication,
  so a request without a session gets `null` rather than a 401.
  """
  def me(conn, _params) do
    case Authenticate.Cookie.verify(conn) do
      {:ok, %Session{subject_id: subject_id}} -> json(conn, User.get(subject_id))
      :error -> json(conn, nil)
    end
  end

  @doc "Responds with every user, with their role."
  def index(conn, _params) do
    json(conn, User.all())
  end

  @doc """
  Gives the user `id` the role `role`, and responds with the user. A role that
  is not one is a 400 with `invalid_role`. Demoting the last admin is a 409
  with `last_admin`, and changing one's own role is a 409 with `self`.
  """
  def update(conn = %{assigns: %{subject_id: subject_id}}, %{"id" => id, "role" => role}) do
    with {:ok, id} <- Params.id(id),
         {:ok, user} <- found(User.get_by_id(id)),
         {:ok, updated} <- User.set_role(user, role, subject_id) do
      json(conn, updated)
    end
  end

  @doc """
  Deletes the user `id` and revokes their sessions. Deleting the last admin is
  a 409 with `last_admin`, and deleting oneself is a 409 with `self`.
  """
  def delete(conn = %{assigns: %{subject_id: subject_id}}, %{"id" => id}) do
    with {:ok, id} <- Params.id(id),
         {:ok, user} <- found(User.get_by_id(id)),
         {:ok, _deleted} <- User.delete(user, subject_id) do
      send_resp(conn, :no_content, "")
    end
  end
end
