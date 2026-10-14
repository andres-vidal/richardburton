defmodule RichardBurtonWeb.ChannelCase do
  @moduledoc """
  The test case for channels. It imports `Phoenix.ChannelTest` and the
  fixtures, and sets up the database sandbox, because connecting and joining
  read sessions and documents from the database.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      import Phoenix.ChannelTest
      import RichardBurton.Fixtures

      @endpoint RichardBurtonWeb.Endpoint
    end
  end

  setup tags do
    RichardBurton.DataCase.setup_sandbox(tags)
    :ok
  end
end
