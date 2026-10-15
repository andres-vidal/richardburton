defmodule RichardBurton.Auth do
  @moduledoc """
  Verifies identity-provider tokens through the implementation set by the
  `:auth_service` application setting, `RichardBurton.Auth.Google` by default.
  The setting lets tests use a mock.
  """

  alias RichardBurton.Auth.Claims

  @doc "Returns the identity the provider vouches for in `token`, or `:error`."
  @callback verify(token :: String.t()) :: {:ok, Claims.identity()} | :error

  @doc """
  Authenticates an ID token. Returns the identity the provider vouches for,
  its subject and verified email, or `:error`.
  """
  @spec verify(token :: String.t()) :: {:ok, Claims.identity()} | :error
  def verify(token), do: impl().verify(token)

  # The configured implementation of the auth service.
  defp impl, do: Application.get_env(:richard_burton, :auth_service, RichardBurton.Auth.Google)
end
