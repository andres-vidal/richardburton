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

  @impl true
  @spec verify(token :: String.t()) :: {:ok, String.t()} | :error
  # `key_store` is injectable (defaulting to the running `KeyStore`) so tests can
  # supply a stub holding a known signing key and exercise the full signature +
  # claims pipeline.
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

  @impl true
  @spec authorize(subject_id :: String.t(), role :: atom()) :: :ok | :error
  def authorize(subject_id, role) do
    case User.get(subject_id) do
      %{role: ^role} -> :ok
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

  defp audience, do: System.get_env("GOOGLE_CLIENT_ID")
end
