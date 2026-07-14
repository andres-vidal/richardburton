defmodule RichardBurton.Auth.Recaptcha.GoogleTest do
  @moduledoc """
  Verifies a reCAPTCHA token against Google's siteverify endpoint. A Bypass server
  stands in for Google so the success and failure branches run without network
  access.
  """
  use ExUnit.Case, async: false

  alias RichardBurton.Auth.Recaptcha.Google

  setup do
    bypass = Bypass.open()
    put_env("GOOGLE_RECAPTCHA_VERIFICATION_URL", "http://localhost:#{bypass.port}/verify")
    put_env("GOOGLE_RECAPTCHA_SECRET_KEY", "test-secret")

    %{bypass: bypass}
  end

  defp put_env(name, value) do
    original = System.get_env(name)
    System.put_env(name, value)

    on_exit(fn ->
      if original, do: System.put_env(name, original), else: System.delete_env(name)
    end)
  end

  defp respond(bypass, status, body) do
    Bypass.expect_once(bypass, "POST", "/verify", fn conn ->
      Plug.Conn.resp(conn, status, body)
    end)
  end

  test "returns :ok when Google accepts the token", %{bypass: bypass} do
    respond(bypass, 200, ~s({"success": true}))

    assert Google.verify("good-token") == :ok
  end

  test "returns the error codes when Google rejects the token", %{bypass: bypass} do
    respond(bypass, 200, ~s({"success": false, "error-codes": ["timeout-or-duplicate"]}))

    assert Google.verify("stale-token") == {:error, ["timeout-or-duplicate"]}
  end

  test "returns a decode error for a non-JSON response", %{bypass: bypass} do
    respond(bypass, 200, "not json")

    assert Google.verify("token") == {:error, "Failed to decode JSON response"}
  end

  test "returns a request error when the endpoint is unreachable", %{bypass: bypass} do
    Bypass.down(bypass)

    assert Google.verify("token") == {:error, "Failed to make verification request"}
  end
end
