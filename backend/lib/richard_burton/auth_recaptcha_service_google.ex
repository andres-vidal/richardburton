defmodule RichardBurton.Auth.Recaptcha.Google do
  @moduledoc """
  The `RichardBurton.Auth.Recaptcha` implementation that asks Google's
  verification endpoint, `GOOGLE_RECAPTCHA_VERIFICATION_URL`, with the secret
  `GOOGLE_RECAPTCHA_SECRET_KEY`.
  """
  @behaviour RichardBurton.Auth.Recaptcha

  @impl true
  @spec verify(token :: String.t()) :: :ok | {:error, [String.t()] | String.t()}
  def verify(token) do
    body =
      URI.encode_query(%{
        "secret" => System.get_env("GOOGLE_RECAPTCHA_SECRET_KEY"),
        "response" => token
      })

    headers = [{"Content-Type", "application/x-www-form-urlencoded"}]

    case HTTPoison.post(System.get_env("GOOGLE_RECAPTCHA_VERIFICATION_URL"), body, headers) do
      {:ok, %{body: response}} -> verdict(Jason.decode(response))
      {:error, _reason} -> {:error, "Failed to make verification request"}
    end
  end

  # Returns `:ok` for a decoded response that reports success, the response's
  # error codes for one that does not, and a decode error for anything else.
  defp verdict({:ok, %{"success" => true}}), do: :ok
  defp verdict({:ok, response}) when is_map(response), do: {:error, response["error-codes"] || []}
  defp verdict(_decoded), do: {:error, "Failed to decode JSON response"}
end
