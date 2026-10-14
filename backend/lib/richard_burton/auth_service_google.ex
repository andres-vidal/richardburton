defmodule RichardBurton.Auth.Google do
  @moduledoc """
  Google identity-provider implementation of the `RichardBurton.Auth` behaviour.

  ID tokens are verified against Google's JWKS signing keys, which are cached
  and refreshed by `RichardBurton.Auth.KeyStore` (using the
  `RichardBurton.Auth.JWKS.Google` provider) so that key rotation does not
  require a restart. The issuer, audience and expiry are all validated (see
  `RichardBurton.Auth.Claims`).
  """
  @behaviour RichardBurton.Auth

  alias RichardBurton.Auth.Claims
  alias RichardBurton.Auth.KeyStore
  alias RichardBurton.User

  @doc """
  Verifies the signature of `token` with the key `key_store` holds for its
  `kid`, then validates its claims with `RichardBurton.Auth.Claims`. Returns
  the identity, or `:error` for a token that fails any check or is malformed.

  `key_store` is a module with `fetch_key/1` and `issuer/0`, the running
  `RichardBurton.Auth.KeyStore` by default.
  """
  @impl true
  @spec verify(String.t(), module()) :: {:ok, Claims.identity()} | :error
  def verify(token, key_store \\ KeyStore) do
    with {:ok, %{"kid" => kid}} <- Joken.peek_header(token),
         {:ok, key} <- key_store.fetch_key(kid),
         {:ok, claims} <- verify_signature(token, key) do
      Claims.validate(claims, key_store.issuer(), audience())
    else
      _ -> :error
    end
  rescue
    # A malformed token (bad header, unusable key, etc.) is just an auth failure.
    _ -> :error
  end

  @doc """
  Returns `:ok` when the account with `subject_id` holds `role` or one that
  outranks it, and `:error` otherwise or when there is no such account.
  """
  @impl true
  @spec authorize(subject_id :: String.t(), role :: atom()) :: :ok | :error
  def authorize(subject_id, role) do
    case User.get(subject_id) do
      %{role: held} -> if User.at_least?(held, role), do: :ok, else: :error
      _ -> :error
    end
  end

  # The signing algorithm is taken from the trusted JWKS key (not the token
  # header), which avoids algorithm-confusion attacks.
  defp verify_signature(token, key) do
    signer = Joken.Signer.create(key["alg"], key)

    case Joken.verify(token, signer) do
      {:ok, claims} -> {:ok, claims}
      _ -> :error
    end
  end

  # The client id a token's `aud` claim must carry, so a token minted for another
  # application is not accepted here.
  defp audience, do: System.get_env("GOOGLE_CLIENT_ID")
end
