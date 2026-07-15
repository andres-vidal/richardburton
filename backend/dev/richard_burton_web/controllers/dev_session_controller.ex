defmodule RichardBurtonWeb.DevSessionController do
  @moduledoc """
  Dev/test-only credentials provider. Mints an admin `rb-session` (plus the
  readable `csrf-token`) without the Google OAuth handshake, so the admin UI can
  be exercised locally.

  Kept out of production two ways: this file lives outside `lib/`, on a compile
  path only added for `:dev`/`:test` (see `elixirc_paths` in `mix.exs`), so the
  module is not compiled into a prod release at all; and the route is wired only
  when `Mix.env() in [:dev, :test]` (see the router).
  """
  use RichardBurtonWeb, :controller

  alias RichardBurton.Auth.Csrf
  alias RichardBurton.Auth.Session
  alias RichardBurton.Repo
  alias RichardBurton.User

  @subject_id "dev-admin"
  @email "dev-admin@localhost"

  @doc "Upserts the dev admin user and sets the session cookies for it."
  def create(conn, _params) do
    user = upsert_admin()
    {:ok, token} = Session.create(@subject_id)

    conn
    |> put_resp_cookie(Session.cookie_name(), token,
      http_only: true,
      same_site: "Lax",
      secure: false,
      max_age: Session.max_age()
    )
    |> put_resp_cookie("csrf-token", Csrf.sign(@subject_id),
      http_only: false,
      same_site: "Lax",
      secure: false,
      max_age: Session.max_age()
    )
    |> put_status(:created)
    |> json(user)
  end

  # `User.changeset` forces the `:reader` role, so write the admin role directly.
  defp upsert_admin do
    case User.get(@subject_id) do
      nil ->
        Repo.insert!(%User{subject_id: @subject_id, email: @email, role: :admin})

      user ->
        user |> Ecto.Changeset.change(role: :admin) |> Repo.update!()
    end
  end
end
