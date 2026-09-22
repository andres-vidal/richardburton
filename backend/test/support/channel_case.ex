defmodule RichardBurtonWeb.ChannelCase do
  @moduledoc """
  The test case for channels: `Phoenix.ChannelTest` plus the database sandbox,
  since joining a channel asks who is allowed to.
  """

  use ExUnit.CaseTemplate

  using do
    quote do
      import Phoenix.ChannelTest
      import RichardBurtonWeb.ChannelCase

      @endpoint RichardBurtonWeb.Endpoint
    end
  end

  setup tags do
    RichardBurton.DataCase.setup_sandbox(tags)
    :ok
  end
end
