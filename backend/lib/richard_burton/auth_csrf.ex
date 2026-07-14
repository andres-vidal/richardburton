defmodule RichardBurton.Auth.Csrf do
  @moduledoc """
  Double-submit CSRF token: a signed, session-bound token issued as a readable
  (`http_only: false`) cookie at login and echoed back in the `rb-csrf-token`
  header on state-changing admin requests (see `RichardBurtonWeb.Plugs.VerifyCsrf`).

  It is signed with the endpoint's `secret_key_base`, so it can't be forged
  without the server secret, and it carries the session's subject so a token
  minted for one user can't authorize another's request. Defense in depth on top
  of the `SameSite=Lax` session cookie.
  """
  alias RichardBurton.Auth.Session
  alias RichardBurtonWeb.Endpoint

  @salt "csrf token"
  # The request header the browser echoes the CSRF token back in.
  @header "rb-csrf-token"

  @doc "Name of the request header carrying the double-submit CSRF token."
  @spec header_name() :: String.t()
  def header_name, do: @header

  @spec sign(String.t()) :: String.t()
  def sign(subject_id) do
    Phoenix.Token.sign(Endpoint, @salt, subject_id)
  end

  @spec verify(term()) :: {:ok, String.t()} | {:error, atom()}
  def verify(token) when is_binary(token) do
    Phoenix.Token.verify(Endpoint, @salt, token, max_age: Session.max_age())
  end

  def verify(_), do: {:error, :invalid}
end
