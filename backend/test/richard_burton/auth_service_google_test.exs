defmodule RichardBurton.Auth.GoogleTest do
  @moduledoc """
  Google identity-provider implementation of the `RichardBurton.Auth` behaviour.

  `verify/1` accepts an injectable key store (a module exposing `fetch_key/1` and
  `issuer/0`), so the full pipeline — signature verification with a real RS256 key
  plus claim validation — is exercised here with a stub store, without reaching
  Google. The `authorize/2` and early `verify/1` failure paths need no store.
  """
  use RichardBurton.DataCase, async: false

  alias RichardBurton.Auth.Google
  alias RichardBurton.User
  alias RichardBurton.Repo

  @issuer "https://accounts.google.com"
  @audience "client-123.apps.googleusercontent.com"

  # A module-shaped key store (what `Google.verify/2` calls: `fetch_key/1` and
  # `issuer/0`), backed by an Agent so a test can seed the public key it signed
  # its token with.
  defmodule StubKeyStore do
    use Agent

    def start_link(state), do: Agent.start_link(fn -> state end, name: __MODULE__)

    def fetch_key(kid) do
      case Map.get(Agent.get(__MODULE__, & &1.keys), kid) do
        nil -> :error
        key -> {:ok, key}
      end
    end

    def issuer, do: Agent.get(__MODULE__, & &1.issuer)
  end

  defp sign(private_key, claims) do
    signer = Joken.Signer.create("RS256", private_key, %{"kid" => "test-kid"})
    {:ok, token, _claims} = Joken.encode_and_sign(claims, signer)
    token
  end

  defp valid_claims(overrides) do
    Map.merge(
      %{
        "iss" => @issuer,
        "aud" => @audience,
        "sub" => "google-subject-42",
        "exp" => System.system_time(:second) + 3600
      },
      overrides
    )
  end

  describe "authorize/2" do
    test "authorizes a subject whose stored role matches" do
      Repo.insert!(%User{subject_id: "admin-1", email: "admin@example.com", role: :admin})

      assert Google.authorize("admin-1", :admin) == :ok
    end

    test "rejects a subject whose stored role does not match" do
      Repo.insert!(%User{subject_id: "reader-1", email: "reader@example.com", role: :reader})

      assert Google.authorize("reader-1", :admin) == :error
    end

    test "rejects an unknown subject" do
      assert Google.authorize("ghost", :admin) == :error
    end
  end

  describe "verify/1 (failure paths, real key store)" do
    test "returns :error for a structurally malformed token" do
      assert Google.verify("not-a-jwt") == :error
    end

    test "returns :error when the token header carries no kid" do
      signer = Joken.Signer.create("HS256", "secret")
      {:ok, token, _claims} = Joken.encode_and_sign(%{"sub" => "x"}, signer)

      assert Google.verify(token) == :error
    end

    test "returns :error when the kid is not known to the key store" do
      signer = Joken.Signer.create("HS256", "secret", %{"kid" => "unknown-kid"})
      {:ok, token, _claims} = Joken.encode_and_sign(%{"sub" => "x"}, signer)

      assert Google.verify(token) == :error
    end
  end

  describe "verify/1 (valid signature, injected key store)" do
    setup do
      original = System.get_env("GOOGLE_CLIENT_ID")
      System.put_env("GOOGLE_CLIENT_ID", @audience)

      on_exit(fn ->
        if original,
          do: System.put_env("GOOGLE_CLIENT_ID", original),
          else: System.delete_env("GOOGLE_CLIENT_ID")
      end)

      jwk = JOSE.JWK.generate_key({:rsa, 2048})
      {_, private_key} = JOSE.JWK.to_map(jwk)
      {_, public_map} = JOSE.JWK.to_public_map(jwk)
      public_key = Map.merge(public_map, %{"alg" => "RS256", "kid" => "test-kid"})

      start_supervised!({StubKeyStore, %{issuer: @issuer, keys: %{"test-kid" => public_key}}})

      %{private_key: private_key}
    end

    test "returns {:ok, subject} for a properly signed, valid token", %{private_key: pk} do
      token = sign(pk, valid_claims(%{}))

      assert Google.verify(token, StubKeyStore) == {:ok, "google-subject-42"}
    end

    test "returns :error for an expired token", %{private_key: pk} do
      token = sign(pk, valid_claims(%{"exp" => System.system_time(:second) - 1}))

      assert Google.verify(token, StubKeyStore) == :error
    end

    test "returns :error when the audience does not match", %{private_key: pk} do
      token = sign(pk, valid_claims(%{"aud" => "another-client"}))

      assert Google.verify(token, StubKeyStore) == :error
    end

    test "returns :error when the issuer does not match", %{private_key: pk} do
      token = sign(pk, valid_claims(%{"iss" => "https://evil.example.com"}))

      assert Google.verify(token, StubKeyStore) == :error
    end

    test "returns :error when the signature was made with a different key", %{
      private_key: _pk
    } do
      other = JOSE.JWK.generate_key({:rsa, 2048})
      {_, other_private} = JOSE.JWK.to_map(other)
      token = sign(other_private, valid_claims(%{}))

      assert Google.verify(token, StubKeyStore) == :error
    end
  end
end
