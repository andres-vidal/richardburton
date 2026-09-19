defmodule RichardBurtonWeb.OriginalBookControllerTest do
  @moduledoc """
  Tests for the OriginalBook controller
  """
  use RichardBurtonWeb.ConnCase
  import Routes, only: [original_book_path: 2]

  alias RichardBurton.OriginalBook

  @books [
    %{"title" => "Dom Casmurro", "authors" => [%{"name" => "Machado de Assis"}]},
    %{
      "title" => "Iracema",
      "authors" => [%{"name" => "José de Alencar"}]
    },
    %{
      "title" => "Manuel de Moraes",
      "authors" => [
        %{"name" => "Machado de Assis"},
        %{"name" => "J. M. Pereira da Silva"}
      ]
    }
  ]

  def search_fixture(_) do
    Enum.each(@books, &OriginalBook.maybe_insert!/1)
    []
  end

  describe "GET /original-books" do
    setup [:search_fixture]

    test "returns every book, with the authors each one holds",
         %{conn: conn} do
      expect_auth_authorize_admin()

      assert [
               %{"title" => "Dom Casmurro", "authors" => ["Machado de Assis"]},
               %{"title" => "Iracema", "authors" => ["José de Alencar"]},
               %{
                 "title" => "Manuel de Moraes",
                 "authors" => ["Machado de Assis", "J. M. Pereira da Silva"]
               }
             ] = conn |> get(original_book_path(conn, :index)) |> json_response(200)
    end

    test "a search finds a book by its title or by one of its authors", %{conn: conn} do
      expect_auth_authorize_admin(2)

      assert [%{"title" => "Dom Casmurro"}] =
               conn
               |> get(original_book_path(conn, :index), %{"search" => "Dom"})
               |> json_response(200)

      assert [%{"title" => "Dom Casmurro"}, %{"title" => "Manuel de Moraes"}] =
               conn
               |> get(original_book_path(conn, :index), %{"search" => "Machado"})
               |> json_response(200)
    end

    test "returns 401 without a session cookie", %{conn: conn} do
      path = original_book_path(conn, :index)
      assert build_conn() |> get(path) |> response(401) == "Unauthorized"
    end
  end
end
