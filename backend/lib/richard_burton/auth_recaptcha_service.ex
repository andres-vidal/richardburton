defmodule RichardBurton.Auth.Recaptcha do
  @moduledoc """
  Verifies reCAPTCHA tokens through the implementation set by the
  `:auth_recaptcha_service` application setting, `RichardBurton.Auth.Recaptcha.Google`
  by default. The setting lets tests use a double.
  """

  @doc """
  Returns `:ok` when the provider verifies `token`, and `{:error, reason}`
  otherwise.
  """
  @callback verify(token :: String.t()) :: :ok | {:error, [String.t()] | String.t()}

  @doc "Verifies `token` with the configured implementation."
  @spec verify(token :: String.t()) :: :ok | {:error, [String.t()] | String.t()}
  def verify(token), do: impl().verify(token)

  # The configured implementation of the recaptcha service.
  defp impl,
    do:
      Application.get_env(
        :richard_burton,
        :auth_recaptcha_service,
        RichardBurton.Auth.Recaptcha.Google
      )
end
