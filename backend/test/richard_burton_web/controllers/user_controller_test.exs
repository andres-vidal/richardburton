defmodule RichardBurtonWeb.UserControllerTest do
  @moduledoc """
  Tests for `RichardBurtonWeb.UserController`: the signed-in user, the list of
  users, and the admin writes that change or remove access.
  """
  use RichardBurtonWeb.ConnCase
  import Routes, only: [user_path: 2, user_path: 3]

  alias RichardBurton.Auth.Session
  alias RichardBurton.Repo
  alias RichardBurton.User

  describe "GET /users" do
    @describetag role: :admin

    test "lists everyone with access, and what they may do", %{conn: conn} do
      user_fixture("contributor@example.com", :contributor)

      conn = get(conn, user_path(conn, :index))

      assert [%{"email" => first}, %{"email" => second}] = json_response(conn, 200)
      assert [first, second] == Enum.sort([session_user_email(), "contributor@example.com"])
    end

    @tag role: :contributor
    test "is refused to anyone who is not an admin", %{conn: conn} do
      conn = get(conn, user_path(conn, :index))

      assert %{"error" => "forbidden"} == json_response(conn, 403)
    end
  end

  describe "PATCH /users/:id" do
    @describetag role: :admin

    test "changes what a user may do", %{conn: conn} do
      user = user_fixture("reader@example.com")

      conn = patch(conn, user_path(conn, :update, user.id), %{"role" => "contributor"})

      assert %{"role" => "contributor"} = json_response(conn, 200)
      assert User.get_by_id(user.id).role == :contributor
    end

    test "refuses an unknown role", %{conn: conn} do
      user = user_fixture("reader@example.com")

      conn = patch(conn, user_path(conn, :update, user.id), %{"role" => "superuser"})

      assert %{"error" => "invalid_role"} = json_response(conn, 400)
      assert User.get_by_id(user.id).role == :reader
    end

    # Another admin can do it; doing it to yourself is a mistake often enough.
    test "refuses to change your own role", %{conn: conn, session_user: me} do
      user_fixture("other-admin@example.com", :admin)

      conn = patch(conn, user_path(conn, :update, me.id), %{"role" => "reader"})

      assert %{"error" => "self"} = json_response(conn, 409)
      assert User.get_by_id(me.id).role == :admin
    end

    test "is not found for an unknown user", %{conn: conn} do
      conn = patch(conn, user_path(conn, :update, 0), %{"role" => "reader"})

      assert %{"error" => "not_found"} = json_response(conn, 404)
    end

    test "is not found for an id that is not a number", %{conn: conn} do
      conn = patch(conn, user_path(conn, :update, "abc"), %{"role" => "reader"})

      assert %{"error" => "not_found"} = json_response(conn, 404)
    end
  end

  describe "DELETE /users/:id" do
    @describetag role: :admin

    test "revokes access, and the sessions signed in as them", %{conn: conn, session_user: me} do
      user = user_fixture("leaving@example.com")
      {:ok, _token} = Session.create(user.subject_id)

      conn = delete(conn, user_path(conn, :delete, user.id))

      assert response(conn, 204)
      assert is_nil(User.get_by_id(user.id))
      assert is_nil(Repo.get_by(Session, subject_id: user.subject_id))
      refute is_nil(Repo.get_by(Session, subject_id: me.subject_id))
    end

    test "refuses to remove yourself", %{conn: conn, session_user: me} do
      user_fixture("an-admin@example.com", :admin)

      conn = delete(conn, user_path(conn, :delete, me.id))

      assert %{"error" => "self"} = json_response(conn, 409)
      refute is_nil(User.get_by_id(me.id))
    end
  end

  describe "GET /users/me" do
    test "returns the current user for a valid rb-session", %{conn: conn} do
      {:ok, _} = User.insert(%{"subject_id" => session_subject_id(), "email" => "me@example.com"})

      conn = get(conn, user_path(conn, :me))

      assert %{"email" => "me@example.com", "role" => "reader"} = json_response(conn, 200)
    end

    test "returns null without a session", %{conn: conn} do
      conn = get(Phoenix.ConnTest.build_conn(), user_path(conn, :me))

      assert is_nil(json_response(conn, 200))
    end
  end
end
