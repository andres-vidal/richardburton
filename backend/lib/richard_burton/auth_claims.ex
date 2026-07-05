defmodule RichardBurton.Auth.Claims do
  @moduledoc """
  Validates the claims of an OIDC ID token: issuer, audience, subject and
  expiry. Signature verification is performed separately (see
  `RichardBurton.Auth.Google`); this module only checks the decoded claims.
  """

  @doc "Returns `{:ok, subject_id}` when every claim is valid, `:error` otherwise."
  @spec validate(map(), String.t() | nil, String.t() | nil, integer()) ::
          {:ok, String.t()} | :error
  def validate(claims, issuer, audience, now \\ System.system_time(:second))

  def validate(%{"iss" => iss, "aud" => aud, "sub" => sub, "exp" => exp}, issuer, audience, now)
      when is_binary(sub) and sub != "" and is_integer(exp) do
    cond do
      is_nil(issuer) or iss != issuer -> :error
      is_nil(audience) or aud != audience -> :error
      # exp is a POSIX timestamp; reject tokens that have reached expiry.
      exp <= now -> :error
      true -> {:ok, sub}
    end
  end

  def validate(_claims, _issuer, _audience, _now), do: :error
end
