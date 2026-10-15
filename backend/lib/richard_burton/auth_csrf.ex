defmodule RichardBurton.Auth.Csrf do
  @moduledoc """
  The token of the double-submit CSRF check. Sign-in sets it in a cookie that
  is not `http_only`, and `RichardBurtonWeb.Plugs.VerifyCsrf` requires each
  state-changing admin request to carry the same token in the `rb-csrf-token`
  header.

  The token is signed with the endpoint's `secret_key_base`, so it cannot be
  forged without the server secret, and it holds the session's subject id, so
  a token signed for one user does not verify for another. It adds to the
  protection of the `SameSite=Lax` session cookie.
  """
  alias RichardBurton.Auth.Session
  alias RichardBurtonWeb.Endpoint

  @salt "csrf token"
  @header "rb-csrf-token"

  @doc "Name of the request header carrying the double-submit CSRF token."
  @spec header_name() :: String.t()
  def header_name, do: @header

  @doc "Returns a token that holds `subject_id`, signed with the endpoint's secret."
  @spec sign(String.t()) :: String.t()
  def sign(subject_id) do
    Phoenix.Token.sign(Endpoint, @salt, subject_id)
  end

  @doc """
  Returns `{:ok, subject_id}` for a token `sign/1` made no longer ago than a
  session's absolute cap, and `{:error, reason}` for any other value.
  """
  @spec verify(term()) :: {:ok, String.t()} | {:error, atom()}
  def verify(token) when is_binary(token) do
    Phoenix.Token.verify(Endpoint, @salt, token, max_age: Session.max_age())
  end

  def verify(_), do: {:error, :invalid}
end
