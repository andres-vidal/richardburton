defmodule RichardBurton.Auth.Google do
  @moduledoc """
  Google idp implementation for RichardBurton.Auth behaviour
  """
  @behaviour RichardBurton.Auth

  alias RichardBurton.User

  @impl true
  @spec init() :: {Map.t(), List.t()}
  def init(), do: {%{}, []}

  @impl true
  @spec verify(token :: String.t()) :: {:ok, String.t()} | :error
  def verify(token) do
    %{"issuer" => issuer} = get_config()
    keys = get_keys()

    do_verify(
      token,
      issuer: issuer,
      audience: get_audience(),
      keys: keys
    )
  end

  @impl true
  @spec authorize(subject_id :: String.t(), role :: Atom.t()) :: :ok | :error
  def authorize(subject_id, role) do
    case User.get(subject_id) do
      %{role: ^role} -> :ok
      _ -> :error
    end
  end

  defp get_audience do
    case System.get_env("GOOGLE_CLIENT_ID") do
      nil -> throw("GOOGLE_CLIENT_ID environment variable is not set")
      audience -> audience
    end
  end

  defp do_verify(token, issuer: issuer, audience: audience, keys: keys) do
    case Joken.verify(token, get_signer(token, keys)) do
      {:ok, %{"iss" => ^issuer, "aud" => ^audience, "sub" => subject_id}} -> {:ok, subject_id}
      _ -> :error
    end
  end

  defp get_signer(token, keys) do
    {:ok, %{"kid" => kid}} = Joken.peek_header(token)
    %{"alg" => alg} = key = Enum.find(keys, fn k -> k["kid"] == kid end)
    Joken.Signer.create(alg, key)
  end

  defp get_config do
    case System.get_env("GOOGLE_OPENID_CONFIG_URL") do
      nil ->
        throw("GOOGLE_OPENID_CONFIG_URL environment variable is not set")

      url ->
        url
        |> HTTPoison.get!()
        |> Map.get(:body)
        |> Jason.decode!()
        |> Map.take(["issuer"])
    end
  end

  defp get_keys do
    case System.get_env("GOOGLE_OAUTH2_CERTS_URL") do
      nil ->
        throw("GOOGLE_OAUTH2_CERTS_URL environment variable is not set")

      url ->
        url
        |> HTTPoison.get!()
        |> Map.get(:body)
        |> Jason.decode!()
        |> Map.get("keys")
    end
  end
end
