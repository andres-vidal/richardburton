defmodule RichardBurtonWeb.ErrorJSONTest do
  @moduledoc """
  Tests that `RichardBurtonWeb.ErrorJSON` renders an error as its status text.
  """
  use ExUnit.Case, async: true

  alias RichardBurtonWeb.ErrorJSON

  test "renders 404.json" do
    assert ErrorJSON.render("404.json", %{}) == %{errors: %{detail: "Not Found"}}
  end

  test "renders 500.json" do
    assert ErrorJSON.render("500.json", %{}) ==
             %{errors: %{detail: "Internal Server Error"}}
  end
end
