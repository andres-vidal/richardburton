defmodule RichardBurton.Auth.KeyStoreTest do
  @moduledoc """
  Tests for the JWKS key store, focused on the key-rotation behaviour: an
  unknown `kid` must trigger a refetch rather than failing until restart.
  """
  use ExUnit.Case, async: false

  alias RichardBurton.Auth.KeyStore

  @issuer "https://accounts.google.com"

  # Agent-backed JWKS provider whose published keys can be changed mid-test to
  # simulate the identity provider rotating its signing keys.
  defmodule StubJWKS do
    use Agent
    @behaviour RichardBurton.Auth.JWKS

    def start_link(result), do: Agent.start_link(fn -> result end, name: __MODULE__)

    def publish(result), do: Agent.update(__MODULE__, fn _ -> result end)

    @impl true
    def fetch, do: Agent.get(__MODULE__, & &1)
  end

  defp key(kid) do
    %{"kid" => kid, "alg" => "RS256", "kty" => "RSA", "n" => "modulus-#{kid}", "e" => "AQAB"}
  end

  defp jwks(kids), do: {:ok, %{issuer: @issuer, keys: Enum.map(kids, &key/1), max_age: 3600}}

  setup do
    start_supervised!({StubJWKS, jwks(["k1"])})

    store =
      start_supervised!(
        {KeyStore, provider: StubJWKS, refresh_cooldown: 0, name: :test_key_store}
      )

    %{store: store}
  end

  test "serves a cached key by kid", %{store: store} do
    assert {:ok, %{"kid" => "k1"}} = KeyStore.fetch_key(store, "k1")
  end

  test "exposes the issuer fetched from the provider", %{store: store} do
    assert KeyStore.issuer(store) == @issuer
  end

  test "returns :error for a kid the provider has not published", %{store: store} do
    assert KeyStore.fetch_key(store, "unknown") == :error
  end

  test "refetches and resolves a rotated key on a cache miss", %{store: store} do
    # k2 is not published yet: a miss triggers a refresh but still fails.
    assert KeyStore.fetch_key(store, "k2") == :error

    # The provider rotates and now publishes k2.
    StubJWKS.publish(jwks(["k1", "k2"]))

    # The next request for k2 misses the cache, refetches, and now resolves it
    # — no restart required.
    assert {:ok, %{"kid" => "k2"}} = KeyStore.fetch_key(store, "k2")
  end

  test "stays available (serves cached keys) when a refresh fails", %{store: store} do
    StubJWKS.publish({:error, :unavailable})

    # A miss triggers a failing refresh; it must not crash and must return :error.
    assert KeyStore.fetch_key(store, "k3") == :error

    # Previously cached keys are still served.
    assert {:ok, %{"kid" => "k1"}} = KeyStore.fetch_key(store, "k1")
  end
end
