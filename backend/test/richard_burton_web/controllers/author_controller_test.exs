defmodule RichardBurtonWeb.AuthorControllerTest do
  @moduledoc """
  Tests for the Author controller
  """
  use RichardBurtonWeb.ConnCase
  import Routes, only: [author_path: 2]

  alias RichardBurton.Author
  alias RichardBurton.Repo

  @author_names [
    "Machado de Assis",
    "Richard Burton",
    "Richard A. Mazzara",
    "Isabel Burton",
    "Clarice Lispector"
  ]

  def search_fixture(_) do
    @author_names
    |> Enum.map(&%{"name" => &1})
    |> Enum.map(&Author.changeset(%Author{}, &1))
    |> Enum.each(&Repo.insert!/1)

    []
  end

  describe "GET /authors" do
    setup [:search_fixture]

    test "returns 200 and all the authors' names when no search param is provided",
         %{conn: conn} do
      expect_auth_authorize_admin()
      conn = get(conn, author_path(conn, :index))
      assert @author_names == json_response(conn, 200)
    end

    test "returns 200 and the relevant authors' names a search param is provided",
         %{conn: conn} do
      expect_auth_authorize_admin()
      conn = get(conn, author_path(conn, :index), %{"search" => "Richard"})
      assert ["Richard Burton", "Richard A. Mazzara"] == json_response(conn, 200)
    end

    test "returns 401 without a session cookie", %{conn: conn} do
      path = author_path(conn, :index)
      assert build_conn() |> get(path) |> response(401) == "Unauthorized"
    end
  end
end
