defmodule RichardBurton.Publication.Index.Refresher do
  @moduledoc """
  Owns the read model: write paths call `refresh/0` once per logical operation
  (a bulk insert, an update), and the refresher rebuilds the `flat_publications`,
  `search_documents` and `search_keywords` materialized views — the flattened
  rows the index lists, and the search documents and keywords stacked on them.

  The strategy comes from `config :richard_burton, :search_index_refresh`:

    * `{:debounced, ms}` (default — dev and prod): signals coalesce; the views
      rebuild once after a quiet window, outside any transaction, with
      `REFRESH MATERIALIZED VIEW CONCURRENTLY` so searches never block and
      writes never wait. Search lags a write by up to the window — the
      documented trade-off.
    * `:sync_concurrent` (e2e): rebuild inline before `refresh/0` returns —
      deterministic for browser tests while exercising the same CONCURRENTLY
      path production runs.
    * `:sync` (test): rebuild inline with a plain `REFRESH` — the ExUnit
      sandbox wraps tests in transactions, where CONCURRENTLY is not allowed.

  In debounced mode the refresher also rebuilds once on boot, covering signals
  lost to a restart and data seeded while the app was down.
  """

  use GenServer

  alias RichardBurton.Repo

  # Quiet window before a coalesced rebuild, unless configured otherwise.
  @default_debounce_ms 2_000

  @doc "Signal that the index is stale. Returns after the rebuild in sync modes."
  def refresh do
    case strategy() do
      :sync -> rebuild(:blocking)
      :sync_concurrent -> rebuild(:concurrent)
      {:debounced, _ms} -> GenServer.cast(__MODULE__, :dirty)
    end

    :ok
  end

  def start_link(opts) do
    {name, opts} = Keyword.pop(opts, :name, __MODULE__)

    if name do
      GenServer.start_link(__MODULE__, opts, name: name)
    else
      # Unnamed instances let tests exercise the scheduling in isolation.
      GenServer.start_link(__MODULE__, opts)
    end
  end

  @impl true
  def init(opts) do
    state = %{
      timer: nil,
      debounce_ms: Keyword.get(opts, :debounce_ms, configured_debounce_ms()),
      # Injectable for coalescing tests; the real rebuild everywhere else.
      rebuild: Keyword.get(opts, :rebuild, fn -> rebuild(:concurrent) end)
    }

    # Catch up on anything written while the refresher wasn't running.
    if Keyword.get(opts, :refresh_on_boot, debounced?()), do: send(self(), :rebuild)

    {:ok, state}
  end

  @impl true
  def handle_cast(:dirty, state) do
    # Trailing-edge debounce: every signal restarts the quiet window.
    if state.timer, do: Process.cancel_timer(state.timer)
    {:noreply, %{state | timer: Process.send_after(self(), :rebuild, state.debounce_ms)}}
  end

  @impl true
  def handle_info(:rebuild, state) do
    # Signals cast during this rebuild wait in the mailbox and coalesce into
    # the next window — a burst never yields more than one trailing rebuild.
    state.rebuild.()
    {:noreply, %{state | timer: nil}}
  end

  # flat_publications feeds search_documents feeds search_keywords, so each is
  # rebuilt before the one that reads it.
  @views ~w[flat_publications search_documents search_keywords]

  defp rebuild(:blocking), do: refresh_views("")
  defp rebuild(:concurrent), do: refresh_views("CONCURRENTLY ")

  defp refresh_views(concurrently) do
    Enum.each(@views, fn view ->
      Repo.query!("REFRESH MATERIALIZED VIEW #{concurrently}#{view}", [], timeout: :infinity)
    end)
  end

  defp strategy do
    Application.get_env(
      :richard_burton,
      :search_index_refresh,
      {:debounced, @default_debounce_ms}
    )
  end

  defp debounced? do
    match?({:debounced, _}, strategy())
  end

  defp configured_debounce_ms do
    case strategy() do
      {:debounced, ms} -> ms
      _ -> @default_debounce_ms
    end
  end
end
