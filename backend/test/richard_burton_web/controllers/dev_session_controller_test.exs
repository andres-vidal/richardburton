defmodule RichardBurtonWeb.DevSessionControllerTest do
  @moduledoc "Tests for the dev/test-only credentials provider."
  use RichardBurtonWeb.ConnCase

  alias RichardBurton.Auth.Session
  alias RichardBurton.User

  describe "POST /api/dev/session" do
    test "mints an admin session and sets the session cookies", %{conn: conn} do
      conn = post(conn, "/api/dev/session")

      result = json_response(conn, 201)

      assert %{"email" => "dev-admin@localhost", "role" => "admin"} = result
      # The rb-session cookie authenticates as a real user with the admin role.
      assert {:ok, subject_id} = Session.verify(conn.resp_cookies["rb-session"].value)
      assert %User{role: :admin} = User.get(subject_id)
      # The readable csrf-token cookie is set too (the frontend echoes it back).
      assert conn.resp_cookies["csrf-token"].value
    end

    test "keeps the dev user an admin when called again", %{conn: conn} do
      post(build_conn(), "/api/dev/session")
      conn = post(conn, "/api/dev/session")

      assert %{"role" => "admin"} = json_response(conn, 201)
    end

    # Signing in as one role must not demote the other, so each gets its own
    # subject — which is what lets a journey be both in turn.
    test "mints a session for the role asked for", %{conn: conn} do
      conn = post(conn, "/api/dev/session", %{"role" => "contributor"})

      assert %{"email" => "dev-contributor@localhost", "role" => "contributor"} =
               json_response(conn, 201)

      assert {:ok, subject_id} = Session.verify(conn.resp_cookies["rb-session"].value)
      assert %User{role: :contributor} = User.get(subject_id)
    end

    test "refuses to invent a role that is not one", %{conn: conn} do
      conn = post(conn, "/api/dev/session", %{"role" => "superuser"})

      assert %{"role" => "admin"} = json_response(conn, 201)
    end
  end
end
