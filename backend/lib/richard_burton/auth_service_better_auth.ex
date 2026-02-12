defmodule RichardBurton.Auth.BetterAuth do
  @moduledoc """
  Better Auth JWT implementation for RichardBurton.Auth behaviour.

  Verifies JWTs issued by Better Auth using JWKS fetched from
  the frontend's /api/auth/jwks endpoint.
  """
  @behaviour RichardBurton.Auth

  alias RichardBurton.User

  @impl true
  @spec init() :: {Map.t(), List.t()}
  def init() do
    {%{}, get_keys()}
  end

  @impl true
  @spec verify(token :: String.t()) :: {:ok, String.t()} | :error
  def verify(token) do
    case Application.get_env(:richard_burton, :auth_config) do
      {_config, keys} when is_list(keys) and keys != [] ->
        do_verify(token, keys)

      _ ->
        # Try to fetch keys on-the-fly if not cached
        case get_keys() do
          keys when is_list(keys) and keys != [] ->
            do_verify(token, keys)

          _ ->
            :error
        end
    end
  end

  @impl true
  @spec authorize(subject_id :: String.t(), role :: Atom.t()) :: :ok | :error
  def authorize(email, role) do
    # With Better Auth, the "subject_id" from verify/1 is actually the email
    case User.get_by_email(email) do
      %{role: ^role} -> :ok
      _ -> :error
    end
  end

  defp do_verify(token, keys) do
    case Joken.peek_header(token) do
      {:ok, %{"kid" => kid}} ->
        case Enum.find(keys, fn k -> k["kid"] == kid end) do
          nil ->
            # Key not found — try refreshing keys
            fresh_keys = get_keys()

            case Enum.find(fresh_keys, fn k -> k["kid"] == kid end) do
              nil -> :error
              key -> verify_with_key(token, key)
            end

          key ->
            verify_with_key(token, key)
        end

      _ ->
        :error
    end
  end

  defp verify_with_key(token, key) do
    %{"alg" => alg} = key
    signer = Joken.Signer.create(alg, key)

    case Joken.verify(token, signer) do
      {:ok, %{"email" => email}} when is_binary(email) ->
        {:ok, email}

      _ ->
        :error
    end
  end

  defp get_keys do
    case System.get_env("BETTER_AUTH_JWKS_URL") do
      nil ->
        throw("BETTER_AUTH_JWKS_URL environment variable is not set")

      url ->
        url
        |> HTTPoison.get!()
        |> Map.get(:body)
        |> Jason.decode!()
        |> Map.get("keys", [])
    end
  rescue
    _ -> []
  end
end
