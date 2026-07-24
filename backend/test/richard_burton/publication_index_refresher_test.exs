defmodule RichardBurton.Publication.Index.RefresherTest do
  use ExUnit.Case, async: true

  alias RichardBurton.Publication.Index.Refresher

  # Exercises the debounced scheduling in isolation: unnamed instances with an
  # injected rebuild that reports to the test instead of touching the database.
  # (The synchronous strategies are covered end-to-end by the index tests, which
  # search right after their seed's refresh.)

  defp start_refresher(debounce_ms) do
    test = self()

    start_supervised!(
      {Refresher,
       name: nil,
       debounce_ms: debounce_ms,
       refresh_on_boot: false,
       rebuild: fn -> send(test, :rebuilt) end}
    )
  end

  test "a burst of signals coalesces into a single rebuild" do
    refresher = start_refresher(50)

    for _ <- 1..5, do: GenServer.cast(refresher, :dirty)

    assert_receive :rebuilt, 500
    refute_receive :rebuilt, 200
  end

  test "every signal restarts the quiet window (trailing-edge debounce)" do
    refresher = start_refresher(200)

    GenServer.cast(refresher, :dirty)
    Process.sleep(120)
    refute_received :rebuilt

    # A second signal inside the window pushes the rebuild out again.
    GenServer.cast(refresher, :dirty)
    Process.sleep(120)
    refute_received :rebuilt

    assert_receive :rebuilt, 500
  end

  test "signals arriving after a rebuild schedule another one" do
    refresher = start_refresher(50)

    GenServer.cast(refresher, :dirty)
    assert_receive :rebuilt, 500

    GenServer.cast(refresher, :dirty)
    assert_receive :rebuilt, 500
  end
end
