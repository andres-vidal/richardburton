defmodule RichardBurtonWeb.UserControllerTest do
  @moduledoc """
  Tests for the user controller
  """
  use RichardBurtonWeb.ConnCase
  import Routes, only: [user_path: 2, user_path: 3]

  alias RichardBurton.Auth.Session
  alias RichardBurton.Repo
  alias RichardBurton.User

  describe "GET /users" do
    test "lists everyone with access, and what they may do", %{conn: conn} do
      create_session_user()
      user_fixture("contributor@example.com", :contributor)
      expect_auth_authorize_admin()

      conn = get(conn, user_path(conn, :index))

      assert [%{"email" => first}, %{"email" => second}] = json_response(conn, 200)
      assert [first, second] == Enum.sort([session_user_email(), "contributor@example.com"])
    end

    test "is refused to anyone who is not an admin", %{conn: conn} do
      refuse_auth_authorize(:admin)

      conn = get(conn, user_path(conn, :index))

      assert response(conn, 401)
    end
  end

  describe "PATCH /users/:id" do
    test "changes what a user may do", %{conn: conn} do
      create_session_user()
      user = user_fixture("reader@example.com")
      expect_auth_authorize_admin()

      conn = patch(conn, user_path(conn, :update, user.id), %{"role" => "contributor"})

      assert %{"role" => "contributor"} = json_response(conn, 200)
      assert User.get_by_id(user.id).role == :contributor
    end

    test "refuses an unknown role", %{conn: conn} do
      create_session_user()
      user = user_fixture("reader@example.com")
      expect_auth_authorize_admin()

      conn = patch(conn, user_path(conn, :update, user.id), %{"role" => "superuser"})

      assert %{"error" => "invalid_role"} = json_response(conn, 400)
      assert User.get_by_id(user.id).role == :reader
    end

    # Another admin can do it; doing it to yourself is a mistake often enough.
    test "refuses to change your own role", %{conn: conn} do
      me = create_session_user()
      {:ok, _} = User.set_role(me, :admin)
      user_fixture("other-admin@example.com", :admin)
      expect_auth_authorize_admin()

      conn = patch(conn, user_path(conn, :update, me.id), %{"role" => "reader"})

      assert %{"error" => "self"} = json_response(conn, 409)
      assert User.get_by_id(me.id).role == :admin
    end

    # Nobody left who can grant access is a state only the database can undo.
    test "refuses to demote the last admin", %{conn: conn} do
      create_session_user()
      only_admin = user_fixture("only-admin@example.com", :admin)
      expect_auth_authorize_admin()

      conn = patch(conn, user_path(conn, :update, only_admin.id), %{"role" => "contributor"})

      assert %{"error" => "last_admin"} = json_response(conn, 409)
      assert User.get_by_id(only_admin.id).role == :admin
    end

    test "is not found for an unknown user", %{conn: conn} do
      create_session_user()
      expect_auth_authorize_admin()

      conn = patch(conn, user_path(conn, :update, 0), %{"role" => "reader"})

      assert %{"error" => "not_found"} = json_response(conn, 404)
    end
  end

  describe "DELETE /users/:id" do
    test "revokes access, and the sessions signed in as them", %{conn: conn} do
      create_session_user()
      user = user_fixture("leaving@example.com")
      {:ok, _token} = Session.create(user.subject_id)
      expect_auth_authorize_admin()

      conn = delete(conn, user_path(conn, :delete, user.id))

      assert response(conn, 204)
      assert is_nil(User.get_by_id(user.id))
      # The session minted in build_conn/0 for the acting admin is the only one left.
      assert Repo.aggregate(Session, :count) == 1
    end

    test "refuses to remove the last admin", %{conn: conn} do
      create_session_user()
      only_admin = user_fixture("only-admin@example.com", :admin)
      expect_auth_authorize_admin()

      conn = delete(conn, user_path(conn, :delete, only_admin.id))

      assert %{"error" => "last_admin"} = json_response(conn, 409)
      refute is_nil(User.get_by_id(only_admin.id))
    end

    test "refuses to remove yourself", %{conn: conn} do
      me = create_session_user()
      user_fixture("an-admin@example.com", :admin)
      expect_auth_authorize_admin()

      conn = delete(conn, user_path(conn, :delete, me.id))

      assert %{"error" => "self"} = json_response(conn, 409)
      refute is_nil(User.get_by_id(me.id))
    end
  end

  describe "GET /users/me" do
    test "returns the current user for a valid rb-session", %{conn: conn} do
      {:ok, _} = User.insert(%{"subject_id" => "12345", "email" => "me@example.com"})

      conn = get(conn, user_path(conn, :me))

      assert %{"email" => "me@example.com", "role" => "reader"} = json_response(conn, 200)
    end

    test "returns null without a session", %{conn: conn} do
      conn = get(Phoenix.ConnTest.build_conn(), user_path(conn, :me))

      assert is_nil(json_response(conn, 200))
    end
  end
end
