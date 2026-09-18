defmodule RichardBurton.Auth.Recaptcha do
  @moduledoc """
  Behaviour for recaptcha authorization services
  """

  @callback verify(token :: String.t()) :: {:ok, String.t()} | {:error, String.t()}

  @spec verify(token :: String.t()) :: {:ok, String.t()} | {:error, String.t()}
  def verify(token), do: impl().verify(token)

  # The configured implementation of the recaptcha service, so tests can supply a double.
  defp impl,
    do:
      Application.get_env(
        :richard_burton,
        :auth_recaptcha_service,
        RichardBurton.Auth.Recaptcha.Google
      )
end
