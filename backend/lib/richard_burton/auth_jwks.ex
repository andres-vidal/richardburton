defmodule RichardBurton.Auth.JWKS do
  @moduledoc """
  Behaviour for fetching a JSON Web Key Set (JWKS): the signing keys and issuer
  used to verify ID tokens, plus the cache lifetime the provider advertises.
  """

  @type result :: %{issuer: String.t() | nil, keys: [map()], max_age: non_neg_integer()}

  @callback fetch() :: {:ok, result()} | {:error, term()}
end
