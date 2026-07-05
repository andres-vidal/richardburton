defmodule RichardBurtonWeb.SessionControllerTest do
  @moduledoc "Tests for the session (login) controller."
  use RichardBurtonWeb.ConnCase

  import Routes, only: [session_path: 2]

  alias RichardBurton.Auth.Session
  alias RichardBurton.User

  @email "user@example.com"
  # expect_auth_verify/1 makes the mocked Auth.verify return {:ok, "12345"}.
  @subject_id "12345"

  describe "POST /sessions" do
    test "verifies the provider token, creates the user, sets rb-session, returns 201", %{
      conn: conn
    } do
      expect_auth_verify(1)

      conn = post(conn, session_path(conn, :create), %{"email" => @email})

      assert %{"email" => @email, "role" => "reader"} = json_response(conn, 201)
      assert Session.verify(conn.resp_cookies["rb-session"].value) == {:ok, @subject_id}
    end

    test "for an existing user, sets rb-session and returns 200 with the user", %{conn: conn} do
      {:ok, _} = User.insert(%{"subject_id" => @subject_id, "email" => @email})
      expect_auth_verify(1)

      conn = post(conn, session_path(conn, :create), %{"email" => @email})

      assert %{"email" => @email, "role" => "reader"} = json_response(conn, 200)
      assert Session.verify(conn.resp_cookies["rb-session"].value) == {:ok, @subject_id}
    end
  end
end
