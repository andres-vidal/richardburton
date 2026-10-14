defmodule RichardBurtonWeb.NameControllerTest do
  @moduledoc """
  Tests for `RichardBurtonWeb.NameController` under the two routes that use
  it: every author or publisher name, the names a search finds, and the
  authentication the routes require.
  """
  use RichardBurtonWeb.ConnCase
  import Routes, only: [author_path: 2, publisher_path: 2]

  alias RichardBurton.Author
  alias RichardBurton.Publisher
  alias RichardBurton.Repo

  @author_names [
    "Machado de Assis",
    "Richard Burton",
    "Richard A. Mazzara",
    "Isabel Burton",
    "Clarice Lispector"
  ]

  @publisher_names [
    "Random House",
    "Bantam Books",
    "Dutton",
    "UMass Dartmouth",
    "University Press of Kentucky"
  ]

  setup do
    for name <- @author_names, do: Repo.insert!(%Author{name: name})
    for name <- @publisher_names, do: Repo.insert!(%Publisher{name: name})
    :ok
  end

  describe "GET /authors" do
    test "returns every author's name when there is no search", %{conn: conn} do
      expect_auth_authorize_admin()
      conn = get(conn, author_path(conn, :index))
      assert @author_names == json_response(conn, 200)
    end

    test "returns the names of the authors a search finds", %{conn: conn} do
      expect_auth_authorize_admin()
      conn = get(conn, author_path(conn, :index), %{"search" => "Richard"})
      assert ["Richard Burton", "Richard A. Mazzara"] == json_response(conn, 200)
    end

    test "falls back to names that resemble a misspelt search", %{conn: conn} do
      expect_auth_authorize_admin()
      conn = get(conn, author_path(conn, :index), %{"search" => "Clarisse Lispector"})
      assert ["Clarice Lispector"] == json_response(conn, 200)
    end

    test "returns 401 without a session cookie", %{conn: conn} do
      path = author_path(conn, :index)
      assert build_conn() |> get(path) |> json_response(401) == %{"error" => "unauthorized"}
    end
  end

  describe "GET /publishers" do
    test "returns every publisher's name when there is no search", %{conn: conn} do
      expect_auth_authorize_admin()
      conn = get(conn, publisher_path(conn, :index))
      assert @publisher_names == json_response(conn, 200)
    end

    test "returns the names of the publishers a search finds", %{conn: conn} do
      expect_auth_authorize_admin()
      conn = get(conn, publisher_path(conn, :index), %{"search" => "U"})
      assert ["UMass Dartmouth", "University Press of Kentucky"] == json_response(conn, 200)
    end

    test "is refused to someone whose role does not reach it", %{conn: conn} do
      refuse_auth_authorize(:contributor)

      conn = get(conn, publisher_path(conn, :index))

      assert %{"error" => "forbidden"} == json_response(conn, 403)
    end
  end
end
