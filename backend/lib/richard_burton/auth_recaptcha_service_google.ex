defmodule RichardBurton.Auth.Recaptcha.Google do
  @moduledoc """
  Google Recaptcha implementation for RichardBurton.Auth.Recaptcha behaviour
  """
  @behaviour RichardBurton.Auth.Recaptcha

  @impl true
  @spec verify(token :: String.t()) :: :ok | {:error, [String.t()] | String.t()}
  def verify(token) do
    verification_url = System.get_env("GOOGLE_RECAPTCHA_VERIFICATION_URL")
    verification_secret = System.get_env("GOOGLE_RECAPTCHA_SECRET_KEY")

    request_body = "secret=#{verification_secret}&response=#{token}"

    request_headers = [
      {"Content-Type", "application/x-www-form-urlencoded"},
      {"Content-Length", Integer.to_string(byte_size(request_body))}
    ]

    case HTTPoison.post(verification_url, request_body, request_headers) do
      {:ok, %{body: response_body}} ->
        case Jason.decode(response_body) do
          {:ok, %{"success" => true}} -> :ok
          {:ok, %{"success" => false, "error-codes" => issues}} -> {:error, issues}
          {:error, _reason} -> {:error, "Failed to decode JSON response"}
        end

      {:error, _reason} ->
        {:error, "Failed to make verification request"}
    end
  end
end
