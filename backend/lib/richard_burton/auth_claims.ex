defmodule RichardBurton.Auth.Claims do
  @moduledoc """
  Validates the claims of an OIDC ID token: issuer, audience, subject, expiry
  and email. Signature verification is performed separately (see
  `RichardBurton.Auth.Google`); this module only checks the decoded claims.

  The email comes from here rather than from whoever calls the login endpoint,
  and only when the provider vouches for it: a role is granted to an address, so
  an address the caller could choose would be a role the caller could choose. A
  provider that will not say whether an address is verified is one this cannot
  accept a login from.
  """

  @type identity :: %{subject_id: String.t(), email: String.t()}

  @doc "Returns `{:ok, identity}` when every claim is valid, `:error` otherwise."
  @spec validate(map(), String.t() | nil, String.t() | nil, integer()) ::
          {:ok, identity()} | :error
  def validate(claims, issuer, audience, now \\ System.system_time(:second))

  def validate(claims, issuer, audience, now) when is_map(claims) do
    with {:ok, subject_id} <- subject(claims),
         {:ok, email} <- verified_email(claims),
         :ok <- matches(claims, "iss", issuer),
         :ok <- matches(claims, "aud", audience),
         :ok <- unexpired(claims, now) do
      {:ok, %{subject_id: subject_id, email: email}}
    end
  end

  def validate(_claims, _issuer, _audience, _now), do: :error

  defp subject(%{"sub" => sub}) when is_binary(sub) and sub != "", do: {:ok, sub}
  defp subject(_claims), do: :error

  defp verified_email(%{"email" => email, "email_verified" => true})
       when is_binary(email) and email != "",
       do: {:ok, email}

  defp verified_email(_claims), do: :error

  defp matches(_claims, _claim, nil), do: :error

  defp matches(claims = %{}, claim, expected),
    do: if(claims[claim] == expected, do: :ok, else: :error)

  # exp is a POSIX timestamp; reject tokens that have reached expiry.
  defp unexpired(%{"exp" => exp}, now) when is_integer(exp) and exp > now, do: :ok
  defp unexpired(_claims, _now), do: :error
end
