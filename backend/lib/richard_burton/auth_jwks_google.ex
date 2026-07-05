defmodule RichardBurton.Auth.JWKS.Google do
  @moduledoc """
  `RichardBurton.Auth.JWKS` implementation that fetches from Google: the issuer
  from Google's OpenID configuration and the signing keys from its OAuth2 certs
  endpoint (respecting the certs' `Cache-Control: max-age`).
  """
  @behaviour RichardBurton.Auth.JWKS

  # Fallback if the certs response carries no Cache-Control max-age.
  @default_max_age 3600

  @impl true
  def fetch do
    with {:ok, issuer} <- fetch_issuer(),
         {:ok, keys, max_age} <- fetch_keys() do
      {:ok, %{issuer: issuer, keys: keys, max_age: max_age}}
    end
  end

  defp fetch_issuer do
    with {:ok, url} <- env("GOOGLE_OPENID_CONFIG_URL"),
         {:ok, %{status_code: 200, body: body}} <- HTTPoison.get(url),
         {:ok, %{"issuer" => issuer}} <- Jason.decode(body) do
      {:ok, issuer}
    else
      _ -> {:error, :openid_config_unavailable}
    end
  end

  defp fetch_keys do
    with {:ok, url} <- env("GOOGLE_OAUTH2_CERTS_URL"),
         {:ok, %{status_code: 200, body: body, headers: headers}} <- HTTPoison.get(url),
         {:ok, %{"keys" => keys}} <- Jason.decode(body) do
      {:ok, keys, max_age(headers)}
    else
      _ -> {:error, :jwks_unavailable}
    end
  end

  defp env(name) do
    case System.get_env(name) do
      value when value in [nil, ""] -> {:error, {:missing_env, name}}
      value -> {:ok, value}
    end
  end

  defp max_age(headers) do
    headers
    |> Enum.find_value(fn {k, v} -> if String.downcase(k) == "cache-control", do: v end)
    |> parse_max_age()
  end

  defp parse_max_age(nil), do: @default_max_age

  defp parse_max_age(cache_control) do
    case Regex.run(~r/max-age=(\d+)/, cache_control) do
      [_, seconds] -> String.to_integer(seconds)
      _ -> @default_max_age
    end
  end
end
