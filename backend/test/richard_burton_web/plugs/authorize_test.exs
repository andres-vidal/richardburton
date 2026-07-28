defmodule RichardBurtonWeb.Plugs.Authorize.AdminTest do
  @moduledoc """
  The Admin plug authorizes only requests whose authenticated subject (assigned
  by an Authenticate plug) has the `:admin` role.
  """
  use ExUnit.Case, async: true

  import Mox
  import Plug.Test
  import Plug.Conn

  alias RichardBurtonWeb.Plugs.Authorize.Admin

  setup :verify_on_exit!

  defp call(conn), do: Admin.call(conn, Admin.init([]))

  test "passes the connection through when the subject has the admin role" do
    expect(RichardBurton.AuthMock, :authorize, fn "admin-subject", :admin -> :ok end)

    conn =
      conn(:get, "/")
      |> assign(:subject_id, "admin-subject")
      |> call()

    refute conn.halted
  end

  test "responds 401 when the subject lacks the admin role" do
    expect(RichardBurton.AuthMock, :authorize, fn _, :admin -> :error end)

    conn =
      conn(:get, "/")
      |> assign(:subject_id, "reader-subject")
      |> call()

    assert conn.halted
    assert conn.status == 401
    assert conn.resp_body == "Unauthorized, not enough privileges"
  end

  test "responds 401 (without calling Auth) when no subject is authenticated" do
    conn = call(conn(:get, "/"))

    assert conn.halted
    assert conn.status == 401
  end
end
