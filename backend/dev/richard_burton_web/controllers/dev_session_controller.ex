defmodule RichardBurtonWeb.DevSessionController do
  @moduledoc """
  Dev/test-only credentials provider. Mints an `rb-session` (plus the readable
  `csrf-token`) without the Google OAuth handshake, so the admin UI can be
  exercised locally.

  A role can be asked for — `%{"role" => "contributor"}` — so the surfaces an
  admin sees and a contributor does not can be exercised as each.

  Kept out of production two ways: this file lives outside `lib/`, on a compile
  path only added for `:dev`, `:test` and `:e2e` (see `elixirc_paths` in
  `mix.exs`), so the
  module is not compiled into a prod release at all; and the route is wired only
  when `Mix.env() in [:dev, :test, :e2e]` (see the router).
  """
  use RichardBurtonWeb, :controller

  alias RichardBurton.Auth.Csrf
  alias RichardBurton.Auth.Session
  alias RichardBurton.Repo
  alias RichardBurton.User

  @doc "Upserts the dev user for the asked-for role and sets its session cookies."
  def create(conn, params) do
    role = role_from(params)
    user = upsert(role)
    {:ok, token} = Session.create(subject_id(role))

    conn
    |> put_resp_cookie(Session.cookie_name(), token,
      http_only: true,
      same_site: "Lax",
      secure: false,
      max_age: Session.max_age()
    )
    |> put_resp_cookie("csrf-token", Csrf.sign(subject_id(role)),
      http_only: false,
      same_site: "Lax",
      secure: false,
      max_age: Session.max_age()
    )
    |> put_status(:created)
    |> json(user)
  end

  defp role_from(params) do
    case User.cast_role(params["role"]) do
      {:ok, role} -> role
      {:error, :invalid_role} -> :admin
    end
  end

  # A subject per role, so signing in as one does not demote the other.
  defp subject_id(role), do: "dev-#{role}"
  defp email(role), do: "dev-#{role}@localhost"

  # The role is asked for, so neither `User.changeset` (which forces `:reader`)
  # nor `User.set_role` (which guards the last admin) applies here.
  defp upsert(role) do
    case User.get(subject_id(role)) do
      nil ->
        Repo.insert!(%User{subject_id: subject_id(role), email: email(role), role: role})

      user ->
        user |> User.role_changeset(%{role: role}) |> Repo.update!()
    end
  end
end
