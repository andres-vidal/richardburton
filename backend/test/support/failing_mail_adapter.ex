defmodule RichardBurton.FailingMailAdapter do
  @moduledoc """
  A Swoosh adapter that sends nothing and answers every delivery with
  `{:error, "smtp is down"}`.

  `install/0` makes it the adapter `RichardBurton.Mailer` sends through until
  the calling test ends. The adapter is an application setting, which every
  process reads, so a test that installs it must not be async.
  """

  use Swoosh.Adapter

  import ExUnit.Callbacks, only: [on_exit: 1]

  @impl true
  def deliver(_email, _config), do: {:error, "smtp is down"}

  @doc """
  Makes this the mailer's adapter for the rest of the calling test, and puts
  the previous one back when the test exits.
  """
  def install do
    previous = Application.fetch_env!(:richard_burton, :mailer_adapter)
    Application.put_env(:richard_burton, :mailer_adapter, __MODULE__)
    on_exit(fn -> Application.put_env(:richard_burton, :mailer_adapter, previous) end)
  end
end
