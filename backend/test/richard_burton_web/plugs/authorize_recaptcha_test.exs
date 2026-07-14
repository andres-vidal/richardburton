defmodule RichardBurtonWeb.Plugs.Authorize.RecaptchaTest do
  @moduledoc """
  The Recaptcha plug guards the contact endpoint, verifying the `recaptcha_token`
  param through `Auth.Recaptcha`.
  """
  use ExUnit.Case, async: true

  import Mox
  import Plug.Test

  alias RichardBurtonWeb.Plugs.Authorize.Recaptcha

  setup :verify_on_exit!

  defp call(params) do
    conn = %{conn(:post, "/") | params: params}
    Recaptcha.call(conn, Recaptcha.init([]))
  end

  test "passes the connection through when the recaptcha token verifies" do
    expect(RichardBurton.Auth.RecaptchaMock, :verify, fn "human" -> :ok end)

    conn = call(%{"recaptcha_token" => "human"})

    refute conn.halted
  end

  test "responds 401 when recaptcha verification fails" do
    expect(RichardBurton.Auth.RecaptchaMock, :verify, fn _ ->
      {:error, ["timeout-or-duplicate"]}
    end)

    conn = call(%{"recaptcha_token" => "bot"})

    assert conn.halted
    assert conn.status == 401
    assert conn.resp_body == "Unauthorized, recaptcha token is invalid"
  end

  test "responds 401 (without calling Auth) when the token param is missing" do
    conn = call(%{})

    assert conn.halted
    assert conn.status == 401
  end
end
