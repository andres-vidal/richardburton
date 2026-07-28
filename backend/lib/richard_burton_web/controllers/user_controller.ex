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
    with user = %User{} <- User.get_by_id(id),
         :ok <- refuse_self(user, subject_id),
         {:ok, updated} <- User.set_role(user, cast_role(role)) do
      json(conn, updated)
    else
      nil -> conn |> put_status(:not_found) |> json(%{error: :not_found})
      {:error, :last_admin} -> conn |> put_status(:conflict) |> json(%{error: :last_admin})
      {:error, :self} -> conn |> put_status(:conflict) |> json(%{error: :self})
      {:error, errors} -> conn |> put_status(:bad_request) |> json(%{errors: errors})
    end
  rescue
    # An unknown role name reaches `String.to_existing_atom/1` as a bad argument.
    ArgumentError -> conn |> put_status(:bad_request) |> json(%{error: :invalid_role})
  end

  @doc "Revoke someone's access, and the sessions signed in as them."
  def delete(conn = %{assigns: %{subject_id: subject_id}}, %{"id" => id}) do
    with user = %User{} <- User.get_by_id(id),
         :ok <- refuse_self(user, subject_id),
         {:ok, _deleted} <- User.delete(user) do
      send_resp(conn, :no_content, "")
    else
      nil -> conn |> put_status(:not_found) |> json(%{error: :not_found})
      {:error, :last_admin} -> conn |> put_status(:conflict) |> json(%{error: :last_admin})
      {:error, :self} -> conn |> put_status(:conflict) |> json(%{error: :self})
    end
  end

  # Changing your own role or removing your own account is a mistake often
  # enough, and never necessary: another admin can do either.
  defp refuse_self(%User{subject_id: subject_id}, subject_id), do: {:error, :self}
  defp refuse_self(_user, _subject_id), do: :ok

  defp cast_role(role) when is_binary(role), do: String.to_existing_atom(role)
end
