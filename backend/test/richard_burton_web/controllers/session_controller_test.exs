defmodule RichardBurtonWeb.SessionControllerTest do
  @moduledoc """
  Tests for `RichardBurtonWeb.SessionController`: who signing in admits, the
  cookies it sets, and signing out.
  """
  use RichardBurtonWeb.ConnCase

  import Mox
  import Routes, only: [session_path: 2]

  alias RichardBurton.Auth.Csrf
  alias RichardBurton.Auth.Session
  alias RichardBurton.Invitation
  alias RichardBurton.Repo
  alias RichardBurton.User

  @email "user@example.com"
  # The subject that `expect_auth_verify/2` makes `Auth.verify/1` vouch for.
  @subject_id RichardBurtonWeb.ConnCase.session_subject_id()

  describe "POST /sessions" do
    test "makes the account for an invited address, with the role offered", %{conn: conn} do
      {:ok, _} = Invitation.invite(%{"email" => @email, "role" => "contributor"})
      expect_auth_verify(1, @email)

      conn = post(conn, session_path(conn, :create), %{})

      assert %{"email" => @email, "role" => "contributor"} = json_response(conn, 200)

      assert {:ok, %Session{subject_id: @subject_id}} =
               Session.verify(conn.resp_cookies["rb-session"].value)

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

      assert {:ok, %Session{subject_id: @subject_id}} =
               Session.verify(conn.resp_cookies["rb-session"].value)

      assert Csrf.verify(conn.resp_cookies["csrf-token"].value) == {:ok, @subject_id}
    end

    test "sets both cookies Secure and SameSite=Lax, and only the session cookie http-only",
         %{conn: conn} do
      {:ok, _} = User.insert(%{"subject_id" => @subject_id, "email" => @email})
      expect_auth_verify(1, @email)

      cookies = post(conn, session_path(conn, :create), %{}).resp_cookies

      assert %{secure: true, same_site: "Lax", http_only: true} = cookies["rb-session"]
      assert %{secure: true, same_site: "Lax", http_only: false} = cookies["csrf-token"]
    end

    test "leaves the cookies without Secure when the session TLS setting is off", %{conn: conn} do
      Application.put_env(:richard_burton, :phx_session_tls, false)
      on_exit(fn -> Application.delete_env(:richard_burton, :phx_session_tls) end)
      {:ok, _} = User.insert(%{"subject_id" => @subject_id, "email" => @email})
      expect_auth_verify(1, @email)

      cookies = post(conn, session_path(conn, :create), %{}).resp_cookies

      assert %{secure: false} = cookies["rb-session"]
      assert %{secure: false} = cookies["csrf-token"]
    end

    # The address decides) which invitation is redeemed and therefore which role
    # is granted, so the body must not be able to name it.
    test "keys the account on the provider's address, not the request body", %{conn: conn} do
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

    test "refuses a provider token that does not verify as unauthorized", %{conn: conn} do
      expect(RichardBurton.AuthMock, :verify, fn _ -> :error end)

      conn = post(conn, session_path(conn, :create), %{})

      assert %{"error" => "unauthorized"} == json_response(conn, 401)
      assert is_nil(conn.resp_cookies["rb-session"])
    end

    test "refuses a request that reaches it with no identity as unauthorized" do
      assert RichardBurtonWeb.SessionController.create(build_conn(), %{}) ==
               {:error, :unauthorized, :unauthorized}
    end
  end

  describe "DELETE /sessions" do
    test "revokes the session, expires the rb-session cookie, returns 204", %{conn: conn} do
      assert Repo.aggregate(Session, :count) == 1

      conn = delete(conn, session_path(conn, :delete))

      assert response(conn, 204)
      assert %{max_age: 0, universal_time: {{1970, 1, 1}, _}} = conn.resp_cookies["rb-session"]
      assert %{max_age: 0, secure: true, http_only: false} = conn.resp_cookies["csrf-token"]
      assert Repo.aggregate(Session, :count) == 0
    end
  end
end
