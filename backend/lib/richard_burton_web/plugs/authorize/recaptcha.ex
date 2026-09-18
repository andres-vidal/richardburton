defmodule RichardBurtonWeb.Plugs.Authorize.Recaptcha do
  @moduledoc """
  Plug for recaptcha verification
  """

  alias RichardBurton.Auth

  import Plug.Conn

  @spec init(any()) :: any()
  def init(params), do: params

  @spec call(Plug.Conn.t(), any()) :: Plug.Conn.t()
  def call(conn, _params) do
    case verify(conn) do
      :ok -> conn
      :error -> halt_unauthorized(conn)
    end
  end

  # The recaptcha token from the request body, verified with the provider. A
  # request carrying none does not pass.
  defp verify(%{params: %{"recaptcha_token" => recaptcha_token}}) do
    case Auth.Recaptcha.verify(recaptcha_token) do
      :ok -> :ok
      {:error, _} -> :error
    end
  end

  defp verify(_conn), do: :error

  # Refuses the request without saying which check failed, so a caller learns
  # nothing it can probe with.
  defp halt_unauthorized(conn) do
    conn |> send_resp(:unauthorized, "Unauthorized, recaptcha token is invalid") |> halt
  end
end
