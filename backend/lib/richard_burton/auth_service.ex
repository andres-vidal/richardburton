defmodule RichardBurton.Auth do
  @moduledoc """
  Authentication/authorization boundary. Delegates to the implementation
  configured under `:auth_service` (default `RichardBurton.Auth.Google`, swapped
  for a Mox mock in tests).
  """

  @callback verify(token :: String.t()) :: {:ok, String.t()} | :error
  @callback authorize(subject_id :: String.t(), role :: atom()) :: :ok | :error

  @doc "Authenticates an ID token, returning `{:ok, subject_id}` or `:error`."
  @spec verify(token :: String.t()) :: {:ok, String.t()} | :error
  def verify(token), do: impl().verify(token)

  @doc "Returns `:ok` if `subject_id` currently holds `role`, `:error` otherwise."
  @spec authorize(subject_id :: String.t(), role :: atom()) :: :ok | :error
  def authorize(subject_id, role), do: impl().authorize(subject_id, role)

  defp impl, do: Application.get_env(:richard_burton, :auth_service, RichardBurton.Auth.Google)
end
