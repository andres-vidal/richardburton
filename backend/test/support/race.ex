defmodule RichardBurton.Race do
  @moduledoc """
  Runs two writes against each other, each on its own connection outside the
  SQL sandbox and in a transaction that commits.

  `run/2` runs the first write and holds its transaction open. It then starts
  the second write, and commits the first one only once the second is waiting
  on a lock or has finished. So the second write always looks for a row before
  the rows the first one wrote are visible to it, which is the interleaving a
  sandboxed test cannot produce.

  The writes commit, so a test that runs them removes what they wrote, for
  example with `truncate!/1` in `on_exit`.
  """

  import ExUnit.Assertions

  alias Ecto.Adapters.SQL.Sandbox
  alias RichardBurton.Repo

  @doc "Runs `fun` on a connection outside the SQL sandbox, so its writes commit."
  def unboxed(fun), do: Sandbox.unboxed_run(Repo, fun)

  @doc """
  Runs `first` and then `second`, each on its own connection, and returns what
  each returned as `:first` and `:second`.

  `first` runs in a transaction that stays open until `second` is waiting on a
  lock or has returned, and then commits. `:waited` is true when `second` was
  waiting on a lock, which shows that it raced `first` rather than running
  after it.
  """
  def run(first, second) do
    test = self()
    holder = Task.async(fn -> unboxed(fn -> hold_open(first, test) end) end)

    assert_receive :first_wrote, 5_000
    challenger = Task.async(fn -> unboxed(second) end)
    waited = await_blocked_or_done(challenger)
    send(holder.pid, :commit)

    %{first: Task.await(holder), second: Task.await(challenger), waited: waited}
  end

  @doc "Empties `tables`, and every table that refers to them."
  def truncate!(tables) do
    unboxed(fn -> Repo.query!("TRUNCATE #{Enum.join(tables, ", ")} CASCADE") end)
  end

  # Runs `write` in a transaction, tells `test` once it has written, and commits
  # when it receives `:commit`. Returns what `write` returned.
  defp hold_open(write, test) do
    {:ok, result} =
      Repo.transaction(fn ->
        result = write.()
        send(test, :first_wrote)

        receive do
          :commit -> result
        end
      end)

    result
  end

  # Returns true once a connection to this database is waiting on a lock, which
  # can only be the task's, or false once `task` has finished without waiting.
  defp await_blocked_or_done(task, attempts \\ 500) do
    cond do
      attempts == 0 -> flunk("the second write neither finished nor waited on a lock")
      waiting_on_a_lock?() -> true
      not Process.alive?(task.pid) -> false
      true -> await_again(task, attempts)
    end
  end

  defp await_again(task, attempts) do
    Process.sleep(10)
    await_blocked_or_done(task, attempts - 1)
  end

  # Returns whether any connection to this database is waiting on a lock.
  defp waiting_on_a_lock? do
    %{rows: [[waiting]]} =
      unboxed(fn ->
        Repo.query!("""
        SELECT count(*) > 0 FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'
        """)
      end)

    waiting
  end
end
