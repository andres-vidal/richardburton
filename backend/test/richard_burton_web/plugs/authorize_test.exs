defmodule RichardBurtonWeb.Plugs.AuthorizeTest do
  @moduledoc """
  The Authorize plug admits a request whose authenticated subject (assigned by
  an Authenticate plug) holds the role the route asks for, or one above it.
  """
  use ExUnit.Case, async: true

  import Mox
  import Plug.Test
  import Plug.Conn

  alias RichardBurtonWeb.Plugs.Authorize

  setup :verify_on_exit!

  defp call(conn, role), do: Authorize.call(conn, Authorize.init(role: role))

  test "passes the connection through when the subject is authorized" do
    expect(RichardBurton.AuthMock, :authorize, fn "admin-subject", :admin -> :ok end)

    conn =
      conn(:get, "/")
      |> assign(:subject_id, "admin-subject")
      |> call(:admin)

    refute conn.halted
  end

  test "asks for the role the route named, not a fixed one" do
    expect(RichardBurton.AuthMock, :authorize, fn "contributor-subject", :contributor -> :ok end)

    conn =
      conn(:get, "/")
      |> assign(:subject_id, "contributor-subject")
      |> call(:contributor)

    refute conn.halted
  end

  test "responds 401 when the subject does not hold it" do
    expect(RichardBurton.AuthMock, :authorize, fn _, :admin -> :error end)

    conn =
      conn(:get, "/")
      |> assign(:subject_id, "reader-subject")
      |> call(:admin)

    assert conn.halted
    assert conn.status == 401
    assert conn.resp_body == "Unauthorized, not enough privileges"
  end

  test "responds 401 (without calling Auth) when no subject is authenticated" do
    conn = call(conn(:get, "/"), :admin)

    assert conn.halted
    assert conn.status == 401
  end

  test "a route must say which role it wants" do
    assert_raise KeyError, fn -> Authorize.init([]) end
  end
end
