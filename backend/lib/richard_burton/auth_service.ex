defmodule RichardBurton.Auth do
  @moduledoc """
  Behaviour for authentication services
  """

  @callback init() :: {Map.t(), List.t()}
  @callback verify(token :: String.t()) :: {:ok, String.t()} | :error
  @callback authorize(subject_id :: String.t(), role :: Atom.t()) :: :ok | :error

  @spec init() :: {Map.t(), List.t()}
  def init, do: impl().init()

  @spec verify(token :: String.t()) :: {:ok, String.t()} | :error
  def verify(token), do: impl().verify(token)

  @spec authorize(subject_id :: String.t(), role :: Atom.t()) :: :ok | :error
  def authorize(subject_id, role), do: impl().authorize(subject_id, role)

  defp impl, do: Application.get_env(:richard_burton, :auth_service, RichardBurton.Auth.BetterAuth)
end
