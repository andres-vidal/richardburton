defmodule RichardBurtonWeb.Plugs.Authorize.Recaptcha do
  @moduledoc """
  Admits a request whose `recaptcha_token` param the reCAPTCHA provider
  verifies, through `RichardBurton.Auth.Recaptcha`.

  A request without the param, or with a token that does not verify, is refused
  with a 403 and the reason `invalid_captcha`.
  """
  @behaviour Plug

  alias RichardBurton.Auth

  import RichardBurtonWeb.Refusal

  @impl true
  def init(params), do: params

  @impl true
  def call(conn, _params) do
    case verify(conn) do
      :ok -> conn
      :error -> refuse(conn, :forbidden, :invalid_captcha)
    end
  end

  # Returns `:ok` when the provider verifies the request's `recaptcha_token`,
  # and `:error` when it does not or when the request has none.
  defp verify(%{params: %{"recaptcha_token" => recaptcha_token}}) do
    case Auth.Recaptcha.verify(recaptcha_token) do
      :ok -> :ok
      {:error, _} -> :error
    end
  end

  defp verify(_conn), do: :error
end
