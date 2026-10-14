defmodule RichardBurtonWeb.DevSessionControllerTest do
  @moduledoc """
  Tests for `RichardBurtonWeb.DevSessionController`, which signs in as a
  development user without Google.
  """
  use RichardBurtonWeb.ConnCase

  alias RichardBurton.Auth.Session
  alias RichardBurton.User

  describe "POST /api/dev/session" do
    test "mints an admin session and sets the session cookies", %{conn: conn} do
      conn = post(conn, "/api/dev/session")

      result = json_response(conn, 201)

      assert %{"email" => "dev-admin@localhost", "role" => "admin"} = result
      # The rb-session cookie holds a session of a stored admin.
      assert {:ok, %Session{subject_id: subject_id}} =
               Session.verify(conn.resp_cookies["rb-session"].value)

      assert %User{role: :admin} = User.get(subject_id)
      # The csrf-token cookie is set too.
      assert conn.resp_cookies["csrf-token"].value
    end

    test "keeps the dev user an admin when called again", %{conn: conn} do
      post(build_conn(), "/api/dev/session")
      conn = post(conn, "/api/dev/session")

      assert %{"role" => "admin"} = json_response(conn, 201)
    end

    # Each role has its own development user, so signing in as one role does
    # not change the role of another.
    test "mints a session for the role asked for", %{conn: conn} do
      conn = post(conn, "/api/dev/session", %{"role" => "contributor"})

      assert %{"email" => "dev-contributor@localhost", "role" => "contributor"} =
               json_response(conn, 201)

      assert {:ok, %Session{subject_id: subject_id}} =
               Session.verify(conn.resp_cookies["rb-session"].value)

      assert %User{role: :contributor} = User.get(subject_id)
    end

    test "refuses to invent a role that is not one", %{conn: conn} do
      conn = post(conn, "/api/dev/session", %{"role" => "superuser"})

      assert %{"role" => "admin"} = json_response(conn, 201)
    end
  end
end
