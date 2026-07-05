defmodule RichardBurton.Auth.KeyStore do
  @moduledoc """
  Caches a provider's JWKS signing keys and keeps them fresh so that key
  rotation does not require restarting the server.

  Provider-agnostic: it caches whatever any `RichardBurton.Auth.JWKS`
  implementation returns. The implementation is configured via the `:jwks_provider`
  application env and can be overridden per instance with the `:provider` option.

  Keys are refreshed:

    * on a schedule, honouring the `max-age` advertised by the provider; and
    * lazily, whenever a token presents a `kid` that is not currently cached
      (rate-limited by `:refresh_cooldown` to avoid hammering the
      provider with bogus `kid`s).
  """
  use GenServer

  @default_provider RichardBurton.Auth.JWKS.Google
  @default_refresh_cooldown 60_000
  @default_max_age 3600

  # Client API

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, opts, name: name)
  end

  @doc "The issuer advertised by the provider, or nil if not fetched yet."
  @spec issuer(GenServer.server()) :: String.t() | nil
  def issuer(server \\ __MODULE__), do: GenServer.call(server, :issuer)

  @doc """
  Returns `{:ok, key}` for the cached key matching `kid`. On a cache miss, the
  keys are refreshed once (rate-limited) before giving up with `:error`.
  """
  @spec fetch_key(GenServer.server(), String.t()) :: {:ok, map()} | :error
  def fetch_key(server \\ __MODULE__, kid), do: GenServer.call(server, {:fetch_key, kid})

  # Server

  @impl true
  def init(opts) do
    state = %{
      provider: Keyword.get(opts, :provider) || configured_provider(),
      refresh_cooldown: Keyword.get(opts, :refresh_cooldown, @default_refresh_cooldown),
      issuer: nil,
      keys: [],
      max_age: @default_max_age,
      refreshed_at: nil
    }

    state = do_refresh(state)
    schedule_next(state)
    {:ok, state}
  end

  @impl true
  def handle_call(:issuer, _from, state), do: {:reply, state.issuer, state}

  def handle_call({:fetch_key, kid}, _from, state) do
    case find_key(state, kid) do
      nil ->
        state = maybe_refresh(state)
        {:reply, reply_for(find_key(state, kid)), state}

      key ->
        {:reply, {:ok, key}, state}
    end
  end

  @impl true
  def handle_info(:scheduled_refresh, state) do
    state = do_refresh(state)
    schedule_next(state)
    {:noreply, state}
  end

  defp configured_provider do
    Application.get_env(:richard_burton, :jwks_provider, @default_provider)
  end

  defp find_key(%{keys: keys}, kid), do: Enum.find(keys, &(&1["kid"] == kid))

  defp reply_for(nil), do: :error
  defp reply_for(key), do: {:ok, key}

  defp maybe_refresh(state) do
    if can_refresh?(state), do: do_refresh(state), else: state
  end

  defp can_refresh?(%{refreshed_at: nil}), do: true

  defp can_refresh?(%{refreshed_at: last, refresh_cooldown: cd}), do: now_ms() - last >= cd

  defp do_refresh(state) do
    case state.provider.fetch() do
      {:ok, %{issuer: issuer, keys: keys, max_age: max_age}} ->
        %{state | issuer: issuer, keys: keys, max_age: max_age, refreshed_at: now_ms()}

      {:ok, %{issuer: issuer, keys: keys}} ->
        %{state | issuer: issuer, keys: keys, refreshed_at: now_ms()}

      {:error, _reason} ->
        # Keep the existing (possibly empty) cache; a later request retries.
        %{state | refreshed_at: now_ms()}
    end
  end

  defp schedule_next(%{max_age: max_age}) when is_integer(max_age) and max_age > 0 do
    Process.send_after(self(), :scheduled_refresh, max_age * 1000)
  end

  defp schedule_next(_state), do: :ok

  defp now_ms, do: System.monotonic_time(:millisecond)
end
