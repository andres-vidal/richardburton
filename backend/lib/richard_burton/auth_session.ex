defmodule RichardBurton.Auth.Session do
  @moduledoc """
  The app's own session tokens: a `Phoenix.Token` carrying the authenticated
  user's `subject_id`, signed with the endpoint's `secret_key_base` and expiring
  after `max_age/0`. Minted after an identity-provider login so requests no
  longer forward the provider's ID token.
  """
  alias RichardBurtonWeb.Endpoint

  @salt "auth session"
  @default_max_age 86_400

  @doc "Signs a session token carrying `subject_id`."
  @spec sign(String.t(), keyword()) :: String.t()
  def sign(subject_id, opts \\ []), do: Phoenix.Token.sign(Endpoint, @salt, subject_id, opts)

  @doc "Verifies a session token, returning `{:ok, subject_id}` or `:error`."
  @spec verify(String.t()) :: {:ok, String.t()} | :error
  def verify(token) do
    case Phoenix.Token.verify(Endpoint, @salt, token, max_age: max_age()) do
      {:ok, subject_id} -> {:ok, subject_id}
      {:error, _reason} -> :error
    end
  end

  @doc "Session lifetime in seconds (configurable via `:session_max_age`)."
  @spec max_age() :: pos_integer()
  def max_age, do: Application.get_env(:richard_burton, :session_max_age, @default_max_age)
end
