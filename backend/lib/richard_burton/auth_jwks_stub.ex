defmodule RichardBurton.Auth.JWKS.Stub do
  @moduledoc """
  `RichardBurton.Auth.JWKS` implementation that fetches nothing.

  Used under test (and in any environment where no identity provider is
  configured) so the key store can run without making network calls. Any token
  verification against it fails cleanly.
  """
  @behaviour RichardBurton.Auth.JWKS

  @impl true
  def fetch, do: {:ok, %{issuer: nil, keys: [], max_age: 0}}
end
