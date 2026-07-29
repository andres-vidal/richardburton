defmodule RichardBurtonWeb.Plugs.Authenticate.BearerTest do
  @moduledoc """
  The Bearer plug authenticates the login endpoints via the identity-provider
  token in the `Authorization` header and assigns `:subject_id`.
  """
  use ExUnit.Case, async: true

  import Mox
  import Plug.Test
  import Plug.Conn

  alias RichardBurtonWeb.Plugs.Authenticate.Bearer

  setup :verify_on_exit!

  defp call(conn), do: Bearer.call(conn, Bearer.init([]))

  test "assigns the identity the provider vouches for when the bearer token verifies" do
    expect(RichardBurton.AuthMock, :verify, fn "good-token" ->
      {:ok, %{subject_id: "subject-1", email: "reader@example.com"}}
    end)

    conn =
      conn(:post, "/")
      |> put_req_header("authorization", "Bearer good-token")
      |> call()

    assert conn.assigns.subject_id == "subject-1"
    # Carried through so the account is keyed on the provider's address rather
    # than one the caller could put in the body.
    assert conn.assigns.email == "reader@example.com"
    refute conn.halted
  end

  test "responds 401 when the token does not verify" do
    expect(RichardBurton.AuthMock, :verify, fn _ -> :error end)

    conn =
      conn(:post, "/")
      |> put_req_header("authorization", "Bearer bad-token")
      |> call()

    assert conn.halted
    assert conn.status == 401
    assert conn.resp_body == "Unauthorized"
  end

  test "responds 401 (without calling Auth) when the header is missing" do
    conn = call(conn(:post, "/"))

    assert conn.halted
    assert conn.status == 401
  end

  test "responds 401 (without calling Auth) when the header is not a Bearer token" do
    conn =
      conn(:post, "/")
      |> put_req_header("authorization", "Basic abc123")
      |> call()

    assert conn.halted
    assert conn.status == 401
  end
end
