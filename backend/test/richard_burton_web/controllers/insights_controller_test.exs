defmodule RichardBurtonWeb.InsightsControllerTest do
  @moduledoc """
  Tests for the Insights controller.
  """
  use RichardBurtonWeb.ConnCase
  import Routes, only: [insights_path: 2, insights_path: 3]

  alias RichardBurton.Publication

  setup do
    [
      %{
        title: "Dom Casmurro",
        year: 1953,
        countries: ["US"],
        publishers: ["Noonday Press"],
        authors: ["Helen Caldwell"],
        original_title: "Dom Casmurro",
        original_authors: ["Machado de Assis"]
      },
      %{
        title: "The Hour of the Star",
        year: 1986,
        countries: ["GB"],
        publishers: ["Carcanet"],
        authors: ["Giovanni Pontiero"],
        original_title: "A hora da estrela",
        original_authors: ["Clarice Lispector"]
      }
    ]
    |> Publication.Codec.nest()
    |> Enum.each(&({:ok, _} = Publication.insert(&1)))

    Publication.Index.Refresher.refresh()
    :ok
  end

  describe "GET /insights" do
    test "describes every publication, without authentication", %{conn: conn} do
      expect_auth_verify(0)

      body = conn |> get(insights_path(conn, :show)) |> json_response(200)

      assert body["publications"] == 2
      assert body["years"] == %{"first" => 1953, "last" => 1986}
      assert body["matched"] == nil

      assert body["original_authors"] == [
               %{"name" => "Clarice Lispector", "count" => 1},
               %{"name" => "Machado de Assis", "count" => 1}
             ]
    end

    test "describes the publications a search matches, and how it read the search", %{
      conn: conn
    } do
      body =
        conn
        |> get(insights_path(conn, :show, search: "clarise"))
        |> json_response(200)

      assert body["publications"] == 1
      assert body["translators"] == [%{"name" => "Giovanni Pontiero", "count" => 1}]
      assert [%{"typed" => "clarise", "words" => ["clarice"]}] = body["matched"]
    end

    test "reads a blank search as none", %{conn: conn} do
      body = conn |> get(insights_path(conn, :show, search: " ")) |> json_response(200)

      assert body["publications"] == 2
      assert body["matched"] == nil
    end
  end
end
