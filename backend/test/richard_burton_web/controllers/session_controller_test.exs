defmodule RichardBurtonWeb.SessionControllerTest do
  @moduledoc "Tests for the session (login) controller."
  use RichardBurtonWeb.ConnCase

  import Routes, only: [session_path: 2]

  alias RichardBurton.Auth.Csrf
  alias RichardBurton.Auth.Session
  alias RichardBurton.Invitation
  alias RichardBurton.Repo
  alias RichardBurton.User

  @email "user@example.com"
  # expect_auth_verify/2 makes the mocked Auth.verify vouch for this subject.
  @subject_id "12345"

  describe "POST /sessions" do
    test "makes the account for an invited address, with the role offered", %{conn: conn} do
      expect_mailer_send()
      {:ok, _} = Invitation.invite(%{"email" => @email, "role" => "contributor"})
      expect_auth_verify(1, @email)

      conn = post(conn, session_path(conn, :create), %{})

      assert %{"email" => @email, "role" => "contributor"} = json_response(conn, 200)
      assert Session.verify(conn.resp_cookies["rb-session"].value) == {:ok, @subject_id}
      assert Csrf.verify(conn.resp_cookies["csrf-token"].value) == {:ok, @subject_id}
    end

    # Anyone may hold a Google account; being invited is what makes one here.
    test "refuses an address nobody invited, and makes no account", %{conn: conn} do
      expect_auth_verify(1, @email)

      conn = post(conn, session_path(conn, :create), %{})

      assert %{"error" => "not_invited"} = json_response(conn, 403)
      assert is_nil(User.get(@subject_id))
      assert is_nil(conn.resp_cookies["rb-session"])
    end

    test "for an existing user, sets rb-session and returns the user", %{conn: conn} do
      {:ok, _} = User.insert(%{"subject_id" => @subject_id, "email" => @email})
      expect_auth_verify(1, @email)

      conn = post(conn, session_path(conn, :create), %{})

      assert %{"email" => @email, "role" => "reader"} = json_response(conn, 200)
      assert Session.verify(conn.resp_cookies["rb-session"].value) == {:ok, @subject_id}
      assert Csrf.verify(conn.resp_cookies["csrf-token"].value) == {:ok, @subject_id}
    end

    # The address decides which invitation is redeemed and therefore which role
    # is granted, so the body must not be able to name it.
    test "keys the account on the provider's address, not the request body", %{conn: conn} do
      expect_mailer_send()
      {:ok, _} = Invitation.invite(%{"email" => @email, "role" => "reader"})
      expect_auth_verify(1, @email)

      conn =
        post(conn, session_path(conn, :create), %{
          "email" => "someone.else@example.com",
          "role" => "admin"
        })

      assert %{"email" => @email, "role" => "reader"} = json_response(conn, 200)
      assert User.get(@subject_id).email == @email
    end
  end

  describe "DELETE /sessions" do
    test "revokes the session, expires the rb-session cookie, returns 204", %{conn: conn} do
      assert Repo.aggregate(Session, :count) == 1

      conn = delete(conn, session_path(conn, :delete))

      assert response(conn, 204)
      assert %{max_age: 0, universal_time: {{1970, 1, 1}, _}} = conn.resp_cookies["rb-session"]
      assert %{max_age: 0} = conn.resp_cookies["csrf-token"]
      assert Repo.aggregate(Session, :count) == 0
    end
  end
end
