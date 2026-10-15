defmodule RichardBurton.Publication.Index.Refresher do
  @moduledoc """
  Rebuilds the materialized views the index reads: `flat_publications`, the
  flat rows the index lists, and `search_documents` and `search_keywords`,
  which are built from them. A write calls `refresh/0` once for each
  operation, such as a bulk insert or an update, after it commits.

  The strategy comes from `config :richard_burton, :search_index_refresh`:

    * `{:debounced, ms}` (the default, used in dev and prod): the signals of a
      burst coalesce, and the views are rebuilt once after `ms` milliseconds
      with no signal, outside any transaction, with
      `REFRESH MATERIALIZED VIEW CONCURRENTLY`, so neither a search nor a
      write waits for the rebuild. A search includes a write up to `ms`
      milliseconds after it.
    * `:sync_concurrent` (e2e): rebuild inline before `refresh/0` returns, with
      the same `CONCURRENTLY` refresh production runs, so an end-to-end test
      reads what it just wrote.
    * `:sync` (test): rebuild inline with a plain `REFRESH`, because the
      ExUnit sandbox runs each test in a transaction, where `CONCURRENTLY` is
      not allowed.

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

  @doc """
  Starts the refresher, registered under `opts[:name]`, `__MODULE__` by
  default, or unregistered when the name is nil. `opts` may also give
  `:debounce_ms`, the quiet window, `:rebuild`, the function that rebuilds the
  views, and `:refresh_on_boot`, whether to rebuild once on start.
  """
  def start_link(opts) do
    {name, opts} = Keyword.pop(opts, :name, __MODULE__)

    if name do
      GenServer.start_link(__MODULE__, opts, name: name)
    else
      GenServer.start_link(__MODULE__, opts)
    end
  end

  @impl true
  def init(opts) do
    state = %{
      timer: nil,
      debounce_ms: Keyword.get(opts, :debounce_ms, configured_debounce_ms()),
      # The function that rebuilds the views.
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
    # The signals cast during this rebuild wait in the mailbox and coalesce
    # into the next window, so a burst gives at most one more rebuild.
    state.rebuild.()
    {:noreply, %{state | timer: nil}}
  end

  # flat_publications feeds search_documents feeds search_keywords, so each is
  # rebuilt before the one that reads it.
  @views ~w[flat_publications search_documents search_keywords]

  # A concurrent refresh keeps the views readable while it runs but needs a
  # unique index on each; the blocking form is used where determinism matters
  # more than availability.
  defp rebuild(:blocking), do: refresh_views("")
  defp rebuild(:concurrent), do: refresh_views("CONCURRENTLY ")

  # Refreshes the view stack bottom-first, since each view reads the one below.
  defp refresh_views(concurrently) do
    Enum.each(@views, fn view ->
      Repo.query!("REFRESH MATERIALIZED VIEW #{concurrently}#{view}", [], timeout: :infinity)
    end)
  end

  # The refresh strategy for this environment: debounced in dev and production,
  # synchronous in test and e2e so a test can read what it just wrote.
  defp strategy do
    Application.get_env(
      :richard_burton,
      :search_index_refresh,
      {:debounced, @default_debounce_ms}
    )
  end

  # Whether writes are coalesced before a refresh.
  defp debounced? do
    match?({:debounced, _}, strategy())
  end

  # How long a burst of writes is allowed to accumulate before the rebuild runs.
  defp configured_debounce_ms do
    case strategy() do
      {:debounced, ms} -> ms
      _ -> @default_debounce_ms
    end
  end
end
