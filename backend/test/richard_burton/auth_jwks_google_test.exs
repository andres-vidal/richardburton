defmodule RichardBurton.Auth.JWKS.GoogleTest do
  @moduledoc """
  Fetches Google's OpenID issuer and JWKS signing keys over HTTP. A Bypass server
  stands in for Google so the success and failure branches run without network
  access.
  """
  use ExUnit.Case, async: false

  alias RichardBurton.Auth.JWKS.Google

  @keys ~s({"keys": [{"kid": "abc", "kty": "RSA", "alg": "RS256", "n": "modulus", "e": "AQAB"}]})
  @config ~s({"issuer": "https://accounts.google.com"})

  setup do
    bypass = Bypass.open()
    base = "http://localhost:#{bypass.port}"
    put_env("GOOGLE_OPENID_CONFIG_URL", "#{base}/openid")
    put_env("GOOGLE_OAUTH2_CERTS_URL", "#{base}/certs")

    %{bypass: bypass}
  end

  defp put_env(name, value) do
    original = System.get_env(name)
    System.put_env(name, value)

    on_exit(fn ->
      if original, do: System.put_env(name, original), else: System.delete_env(name)
    end)
  end

  defp expect(bypass, method, path, status, body, headers \\ []) do
    Bypass.expect_once(bypass, method, path, fn conn ->
      conn = Enum.reduce(headers, conn, fn {k, v}, c -> Plug.Conn.put_resp_header(c, k, v) end)
      Plug.Conn.resp(conn, status, body)
    end)
  end

  test "returns the issuer, keys and max-age on success", %{bypass: bypass} do
    expect(bypass, "GET", "/openid", 200, @config)
    expect(bypass, "GET", "/certs", 200, @keys, [{"cache-control", "public, max-age=7200"}])

    issuer = "https://accounts.google.com"

    assert {:ok, %{issuer: ^issuer, keys: keys, max_age: 7200}} = Google.fetch()
    assert [%{"kid" => "abc", "alg" => "RS256"}] = keys
  end

  test "defaults max-age to 3600 when Cache-Control is absent", %{bypass: bypass} do
    expect(bypass, "GET", "/openid", 200, @config)
    # Plug sets a default `cache-control: max-age=0` header; drop it so this
    # exercises the truly-absent case (the fallback), not a max-age of 0.
    Bypass.expect_once(bypass, "GET", "/certs", fn conn ->
      conn
      |> Plug.Conn.delete_resp_header("cache-control")
      |> Plug.Conn.resp(200, @keys)
    end)

    assert {:ok, %{max_age: 3600}} = Google.fetch()
  end

  test "errors when the OpenID config is unavailable", %{bypass: bypass} do
    expect(bypass, "GET", "/openid", 404, "not found")

    assert Google.fetch() == {:error, :openid_config_unavailable}
  end

  test "errors when the JWKS endpoint returns a server error", %{bypass: bypass} do
    expect(bypass, "GET", "/openid", 200, @config)
    expect(bypass, "GET", "/certs", 500, "boom")

    assert Google.fetch() == {:error, :jwks_unavailable}
  end

  test "errors when the JWKS body is not valid JSON", %{bypass: bypass} do
    expect(bypass, "GET", "/openid", 200, @config)
    expect(bypass, "GET", "/certs", 200, "not json")

    assert Google.fetch() == {:error, :jwks_unavailable}
  end

  test "errors when the certs URL is not configured", %{bypass: bypass} do
    expect(bypass, "GET", "/openid", 200, @config)
    System.delete_env("GOOGLE_OAUTH2_CERTS_URL")

    assert Google.fetch() == {:error, :jwks_unavailable}
  end
end
