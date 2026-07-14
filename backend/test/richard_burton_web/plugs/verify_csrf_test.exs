defmodule RichardBurtonWeb.Plugs.VerifyCsrfTest do
  @moduledoc """
  The VerifyCsrf plug is a double-submit CSRF check: safe methods pass, unsafe
  ones require an `rb-csrf-token` header whose signed subject matches the session.
  """
  use ExUnit.Case, async: true

  import Plug.Test
  import Plug.Conn

  alias RichardBurtonWeb.Plugs.VerifyCsrf
  alias RichardBurton.Auth.Csrf

  @subject "subject-99"

  defp call(conn), do: VerifyCsrf.call(conn, VerifyCsrf.init([]))

  test "passes safe methods through untouched" do
    conn = call(conn(:get, "/"))

    refute conn.halted
  end

  test "passes an unsafe request whose token matches the authenticated subject" do
    conn =
      conn(:post, "/")
      |> assign(:subject_id, @subject)
      |> put_req_header("rb-csrf-token", Csrf.sign(@subject))
      |> call()

    refute conn.halted
  end

  test "responds 403 when the CSRF header is missing" do
    conn =
      conn(:post, "/")
      |> assign(:subject_id, @subject)
      |> call()

    assert conn.halted
    assert conn.status == 403
    assert conn.resp_body == "Invalid CSRF token"
  end

  test "responds 403 when the CSRF token is tampered" do
    conn =
      conn(:post, "/")
      |> assign(:subject_id, @subject)
      |> put_req_header("rb-csrf-token", Csrf.sign(@subject) <> "tamper")
      |> call()

    assert conn.halted
    assert conn.status == 403
  end

  test "responds 403 when the token is signed for a different subject" do
    conn =
      conn(:post, "/")
      |> assign(:subject_id, @subject)
      |> put_req_header("rb-csrf-token", Csrf.sign("someone-else"))
      |> call()

    assert conn.halted
    assert conn.status == 403
  end
end
