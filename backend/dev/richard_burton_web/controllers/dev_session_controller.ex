defmodule RichardBurtonWeb.DevSessionController do
  @moduledoc """
  Signs in without Google, as a development user with the role the request
  asks for, and sets the cookies of `RichardBurtonWeb.SignInCookies`.

  Each role has its own development user, `dev-<role>@localhost`, so that
  signing in as one role does not change the role of another.

  The module is compiled only in the `:dev`, `:test` and `:e2e` environments,
  whose compile paths include `dev/` (see `elixirc_paths` in `mix.exs`), and
  the router mounts its route only in those environments.
  """
  use RichardBurtonWeb, :controller

  alias RichardBurton.Repo
  alias RichardBurton.User
  alias RichardBurtonWeb.SignInCookies

  @doc """
  Inserts or updates the development user for the `role` parameter, signs in
  as them and responds with the user. A missing or unknown role is read as
  `admin`.
  """
  def create(conn, params) do
    role = role_from(params)
    user = upsert(role)

    conn
    |> SignInCookies.put(subject_id(role))
    |> put_status(:created)
    |> json(user)
  end

  # Returns the role the `role` parameter names, or `:admin` when it names
  # none.
  defp role_from(params) do
    case User.cast_role(params["role"]) do
      {:ok, role} -> role
      {:error, :invalid_role} -> :admin
    end
  end

  # Returns the subject id of the development user for `role`.
  defp subject_id(role), do: "dev-#{role}"

  # Returns the email of the development user for `role`.
  defp email(role), do: "dev-#{role}@localhost"

  # Inserts the development user for `role`, or gives the stored one that role
  # again, and returns the user. It writes the role directly, because
  # `User.changeset/2` always gives a new user the reader role and
  # `User.set_role/3` refuses to demote the last admin.
  defp upsert(role) do
    case User.get(subject_id(role)) do
      nil ->
        Repo.insert!(%User{subject_id: subject_id(role), email: email(role), role: role})

      user ->
        user |> User.role_changeset(%{role: role}) |> Repo.update!()
    end
  end
end
