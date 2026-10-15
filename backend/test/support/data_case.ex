defmodule RichardBurton.DataCase do
  @moduledoc """
  The test case for the data layer. It imports `Ecto.Changeset`,
  `Ecto.Query`, the fixtures and the helpers below, and runs each test in the
  database sandbox, so that its writes are rolled back when it ends.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      alias RichardBurton.Repo

      import Ecto.Changeset
      import Ecto.Query
      import RichardBurton.DataCase
      import RichardBurton.Fixtures
    end
  end

  setup tags do
    RichardBurton.DataCase.setup_sandbox(tags)
    :ok
  end

  @doc """
  Checks out a sandbox connection for the test, and checks it in when the test
  exits. The connection is shared with every process unless the test is async.
  """
  def setup_sandbox(tags) do
    pid =
      Ecto.Adapters.SQL.Sandbox.start_owner!(RichardBurton.Repo,
        shared: not tags[:async]
      )

    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(pid) end)
  end

  @doc """
  Returns the errors of `changeset` as a map of messages by field, with each
  message's `%{key}` placeholders filled in.

      assert %{title: ["can't be blank"]} = errors_on(changeset)
  """
  def errors_on(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {message, opts} ->
      Regex.replace(~r"%{(\w+)}", message, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end

  @doc """
  Runs `fun`, and returns what it returned and the number of queries the
  calling process sent through the repository meanwhile. When `matching` is
  given, only the queries whose SQL it returns true for are counted.
  """
  def count_queries(fun, matching \\ fn _sql -> true end) do
    test = self()
    handler = "count-queries-#{inspect(make_ref())}"

    :telemetry.attach(
      handler,
      [:richard_burton, :repo, :query],
      fn _event, _measurements, %{query: query}, _config ->
        if self() == test and matching.(query), do: send(test, :query)
      end,
      nil
    )

    try do
      result = fun.()
      {result, received(:query, 0)}
    after
      :telemetry.detach(handler)
    end
  end

  # Returns `count` plus the number of `message`s in the mailbox, and takes them
  # out of it.
  defp received(message, count) do
    receive do
      ^message -> received(message, count + 1)
    after
      0 -> count
    end
  end

  @doc """
  Runs `fun` in a transaction that is rolled back, and returns what it
  returned.
  """
  def rolled_back(fun) do
    {:error, result} =
      RichardBurton.Repo.transaction(fn -> RichardBurton.Repo.rollback(fun.()) end)

    result
  end
end
