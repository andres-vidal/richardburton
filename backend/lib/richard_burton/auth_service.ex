defmodule RichardBurton.Auth do
  @moduledoc """
  Verifies identity-provider tokens and checks roles, through the
  implementation set by the `:auth_service` application setting,
  `RichardBurton.Auth.Google` by default. The setting lets tests use a mock.
  """

  alias RichardBurton.Auth.Claims

  @doc "Returns the identity the provider vouches for in `token`, or `:error`."
  @callback verify(token :: String.t()) :: {:ok, Claims.identity()} | :error

  @doc "Returns `:ok` when `subject_id` holds `role` or one that outranks it."
  @callback authorize(subject_id :: String.t(), role :: atom()) :: :ok | :error

  @doc """
  Authenticates an ID token. Returns the identity the provider vouches for,
  its subject and verified email, or `:error`.
  """
  @spec verify(token :: String.t()) :: {:ok, Claims.identity()} | :error
  def verify(token), do: impl().verify(token)

  @doc """
  Returns `:ok` if `subject_id` holds `role` or one that outranks it, `:error`
  otherwise. Asking for the least privilege a route needs means a role added
  above it is admitted without revisiting the route.
  """
  @spec authorize(subject_id :: String.t(), role :: atom()) :: :ok | :error
  def authorize(subject_id, role), do: impl().authorize(subject_id, role)

  # The configured implementation of the auth service.
  defp impl, do: Application.get_env(:richard_burton, :auth_service, RichardBurton.Auth.Google)
end
