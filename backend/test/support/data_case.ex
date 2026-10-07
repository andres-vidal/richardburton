defmodule RichardBurton.DataCase do
  @moduledoc """
  This module defines the setup for tests requiring
  access to the application's data layer.

  You may define functions here to be used as helpers in
  your tests.

  Finally, if the test case interacts with the database,
  we enable the SQL sandbox, so changes done to the database
  are reverted at the end of every test. If you are using
  PostgreSQL, you can even run database tests asynchronously
  by setting `use RichardBurton.DataCase, async: true`, although
  this option is not recommended for other databases.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      alias RichardBurton.Repo

      import Ecto
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
  Sets up the sandbox based on the test tags.
  """
  def setup_sandbox(tags) do
    pid =
      Ecto.Adapters.SQL.Sandbox.start_owner!(RichardBurton.Repo,
        shared: not tags[:async]
      )

    on_exit(fn -> Ecto.Adapters.SQL.Sandbox.stop_owner(pid) end)
  end

  @doc """
  A helper that transforms changeset errors into a map of messages.

      assert {:error, changeset} = Accounts.create_user(%{password: "short"})
      assert "password is too short" in errors_on(changeset).password
      assert %{password: ["password is too short"]} = errors_on(changeset)

  """
  def errors_on(changeset) do
    Ecto.Changeset.traverse_errors(changeset, fn {message, opts} ->
      Regex.replace(~r"%{(\w+)}", message, fn _, key ->
        opts |> Keyword.get(String.to_existing_atom(key), key) |> to_string()
      end)
    end)
  end

  @doc """
  Runs `fun`, and returns what it returned and the number of queries it sent
  through the repository.
  """
  def count_queries(fun) do
    test = self()
    handler = "count-queries-#{inspect(test)}"

    :telemetry.attach(
      handler,
      [:richard_burton, :repo, :query],
      fn _event, _measurements, _metadata, _config -> send(test, :query) end,
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
