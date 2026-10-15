defmodule RichardBurtonWeb.CountryControllerTest do
  @moduledoc """
  Tests for `RichardBurtonWeb.CountryController`: every country or those a
  search finds, named in the locale asked for, without authentication.
  """
  use RichardBurtonWeb.ConnCase
  import Routes, only: [country_path: 2, country_path: 3]

  describe "GET /countries" do
    test "lists every country by code and name, in English by default", %{conn: conn} do
      expect_auth_verify(0)

      countries = conn |> get(country_path(conn, :index)) |> json_response(200)

      assert %{"id" => "BR", "label" => "Brazil"} = Enum.find(countries, &(&1["id"] == "BR"))
      assert length(countries) > 200
    end

    test "names the countries in the locale asked for", %{conn: conn} do
      countries = conn |> get(country_path(conn, :index, locale: "pt")) |> json_response(200)

      assert %{"label" => "Brasil"} = Enum.find(countries, &(&1["id"] == "BR"))
    end

    test "reads an unknown locale as English", %{conn: conn} do
      countries = conn |> get(country_path(conn, :index, locale: "xx")) |> json_response(200)

      assert %{"label" => "Brazil"} = Enum.find(countries, &(&1["id"] == "BR"))
    end

    test "returns the countries a search finds, in any language", %{conn: conn} do
      assert [%{"id" => "BR", "label" => "Brasil"}] =
               conn
               |> get(country_path(conn, :index, search: "Brazil", locale: "pt"))
               |> json_response(200)
    end
  end
end
