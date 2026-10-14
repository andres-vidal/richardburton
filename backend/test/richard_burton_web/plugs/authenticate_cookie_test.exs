defmodule RichardBurtonWeb.Plugs.Authenticate.CookieTest do
  @moduledoc """
  The Cookie plug authenticates a request by the app's own `rb-session` cookie,
  which holds a stored `Auth.Session`, and assigns `:subject_id`.
  """
  use RichardBurton.DataCase, async: true

  import Plug.Test

  alias RichardBurtonWeb.Plugs.Authenticate.Cookie
  alias RichardBurton.Auth.Session

  defp call(conn), do: Cookie.call(conn, Cookie.init([]))

  test "assigns the subject id when the session cookie is valid" do
    {:ok, token} = Session.create("subject-42")

    conn =
      conn(:get, "/")
      |> put_req_cookie("rb-session", token)
      |> call()

    assert conn.assigns.subject_id == "subject-42"
    refute conn.halted
  end

  test "responds 401 when the session cookie is missing" do
    conn = call(conn(:get, "/"))

    assert conn.halted
    assert conn.status == 401
    assert Jason.decode!(conn.resp_body) == %{"error" => "unauthorized"}
  end

  test "responds 401 when the session token is not valid" do
    conn =
      conn(:get, "/")
      |> put_req_cookie("rb-session", "not-a-real-token")
      |> call()

    assert conn.halted
    assert conn.status == 401
  end
end
