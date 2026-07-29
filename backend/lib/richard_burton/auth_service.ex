defmodule RichardBurton.Auth do
  @moduledoc """
  Authentication/authorization boundary. Delegates to the implementation
  configured under `:auth_service` (default `RichardBurton.Auth.Google`, swapped
  for a Mox mock in tests).
  """

  alias RichardBurton.Auth.Claims

  @callback verify(token :: String.t()) :: {:ok, Claims.identity()} | :error
  @callback authorize(subject_id :: String.t(), role :: atom()) :: :ok | :error

  @doc """
  Authenticates an ID token, returning the identity the provider vouches for —
  the subject and its verified email — or `:error`.
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

  defp impl, do: Application.get_env(:richard_burton, :auth_service, RichardBurton.Auth.Google)
end
