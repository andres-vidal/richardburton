defmodule RichardBurtonWeb.UserControllerTest do
  @moduledoc """
  Tests for the user controller
  """
  use RichardBurtonWeb.ConnCase
  import Routes, only: [user_path: 2]

  alias RichardBurton.User

  @valid_attrs %{"email" => "example@gmail.com"}
  @successful_return %{"email" => "example@gmail.com", "role" => "reader"}

  describe "POST /users" do
    test "when providing valid params, returns 201 created and the inserted user",
         %{conn: conn} do
      expect_auth_verify()
      conn = post(conn, user_path(conn, :create), @valid_attrs)
      assert @successful_return == json_response(conn, 201)
    end

    test "when providing invalid params, returs 400 bad request",
         %{conn: conn} do
      expect_auth_verify()
      conn = post(conn, user_path(conn, :create), %{"email" => nil})
      assert is_nil(json_response(conn, 400))
    end

    test "when providing duplicated params, returns 409 conflict with the inserted user",
         %{conn: conn} do
      expect_auth_verify(3)

      conn = post(conn, user_path(conn, :create), @valid_attrs)
      assert @successful_return == json_response(conn, 201)

      conn = post(conn, user_path(conn, :create), @valid_attrs)
      assert @successful_return == json_response(conn, 409)

      conn =
        post(conn, user_path(conn, :create), %{
          "email" => "example+1@gmail.com",
          "subject_id" => "1245"
        })

      assert @successful_return == json_response(conn, 409)
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
