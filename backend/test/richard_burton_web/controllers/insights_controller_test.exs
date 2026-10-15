defmodule RichardBurtonWeb.InsightsControllerTest do
  @moduledoc """
  Tests for `RichardBurtonWeb.InsightsController`: the counts and the chart for
  the whole index or for a search, and the chart parameters it refuses.
  """
  use RichardBurtonWeb.ConnCase
  import Routes, only: [insights_path: 2, insights_path: 3]

  setup do
    seed_index([
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
    ])

    :ok
  end

  describe "GET /insights" do
    test "describes every publication, without authentication", %{conn: conn} do
      expect_auth_verify(0)

      body = conn |> get(insights_path(conn, :show)) |> json_response(200)

      assert body["publications"] == 2
      assert body["years"] == %{"first" => 1953, "last" => 1986}
      assert body["totals"]["countries"] == 2
      assert body["matched"] == nil

      # Without parameters, the chart counts publications by year.
      assert %{"series" => [nil], "hidden" => 0, "groups" => groups} = body["chart"]
      assert length(groups) == 1986 - 1953 + 1
      assert hd(groups) == %{"key" => 1953, "total" => 1, "counts" => [1]}
    end

    test "draws the chart the parameters describe", %{conn: conn} do
      body =
        conn
        |> get(
          insights_path(conn, :show,
            count: "translations",
            by: "work",
            over: "decade",
            first: "true",
            top: "1"
          )
        )
        |> json_response(200)

      # The two works have one translation each, and tie on publications, so
      # the first by title is kept.
      assert body["chart"] == %{
               "series" => [nil],
               "hidden" => 1,
               "groups" => [
                 %{
                   "key" => %{"title" => "A hora da estrela", "authors" => ["Clarice Lispector"]},
                   "total" => 1,
                   "counts" => [1],
                   "steps" => [
                     %{"at" => 1980, "total" => 1, "items" => [["Giovanni Pontiero"]]}
                   ]
                 }
               ]
             }
    end

    test "refuses a chart parameter that is not valid, and names it", %{conn: conn} do
      body =
        conn
        |> get(insights_path(conn, :show, by: "decade", over: "year", count: "readers"))
        |> json_response(400)

      assert body == %{"errors" => %{"count" => "invalid", "over" => "invalid"}}
    end

    test "describes the publications a search matches, and how it read the search", %{
      conn: conn
    } do
      body =
        conn
        |> get(insights_path(conn, :show, search: "clarise", by: "translator"))
        |> json_response(200)

      assert body["publications"] == 1

      assert body["chart"]["groups"] == [
               %{"key" => "Giovanni Pontiero", "total" => 1, "counts" => [1]}
             ]

      assert [%{"typed" => "clarise", "words" => ["clarice"]}] = body["matched"]
    end

    test "looks each word of a search up once", %{conn: conn} do
      {body, lookups} =
        counting_keyword_lookups(fn ->
          conn
          |> get(insights_path(conn, :show, search: "clarise lispectr"))
          |> json_response(200)
        end)

      assert lookups == 1
      assert body["publications"] == 1
      assert length(body["matched"]) == 2
    end

    test "reads a blank search as none", %{conn: conn} do
      body = conn |> get(insights_path(conn, :show, search: " ")) |> json_response(200)

      assert body["publications"] == 2
      assert body["matched"] == nil
    end
  end
end
