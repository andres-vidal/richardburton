defmodule RichardBurtonWeb.Plugs.AuthorizeTest do
  @moduledoc """
  The Authorize plug admits a request whose authenticated subject (assigned by
  an Authenticate plug) holds the role the route asks for, or one above it.
  """
  use RichardBurton.DataCase, async: true

  import Plug.Test
  import Plug.Conn

  alias RichardBurtonWeb.Plugs.Authorize

  defp call(conn, role), do: Authorize.call(conn, Authorize.init(role: role))

  test "passes the connection through when the subject is authorized" do
    admin = user_fixture("admin@example.com", :admin)

    conn =
      conn(:get, "/")
      |> assign(:subject_id, admin.subject_id)
      |> call(:admin)

    refute conn.halted
  end

  test "asks for the role the route named, not a fixed one" do
    contributor = user_fixture("contributor@example.com", :contributor)

    conn =
      conn(:get, "/")
      |> assign(:subject_id, contributor.subject_id)
      |> call(:contributor)

    refute conn.halted
  end

  test "responds 403 forbidden when the subject does not hold it" do
    reader = user_fixture("reader@example.com")

    conn =
      conn(:get, "/")
      |> assign(:subject_id, reader.subject_id)
      |> call(:admin)

    assert conn.halted
    assert conn.status == 403
    assert Jason.decode!(conn.resp_body) == %{"error" => "forbidden"}
  end

  test "responds 403 forbidden when no subject is authenticated" do
    conn = call(conn(:get, "/"), :admin)

    assert conn.halted
    assert conn.status == 403
    assert Jason.decode!(conn.resp_body) == %{"error" => "forbidden"}
  end

  test "a route must say which role it wants" do
    assert_raise KeyError, fn -> Authorize.init([]) end
  end
end
