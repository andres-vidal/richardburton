defmodule RichardBurtonWeb do
  @moduledoc """
  The definitions shared by the web interface's controllers, router and
  channels, used as:

      use RichardBurtonWeb, :controller

  Each definition holds only `use`, `import` and `alias` lines. Helper
  functions live in their own modules and are imported here.
  """

  def controller do
    quote do
      use Phoenix.Controller, formats: [:json]

      import Plug.Conn
      import RichardBurtonWeb.FallbackController, only: [found: 1]
      import RichardBurtonWeb.Actor, only: [actor: 1]

      action_fallback(RichardBurtonWeb.FallbackController)
    end
  end

  def router do
    quote do
      use Phoenix.Router

      import Plug.Conn
      import Phoenix.Controller
    end
  end

  def channel do
    quote do
      use Phoenix.Channel
    end
  end

  @doc """
  Returns the definition named by `which`, such as `:controller`.
  """
  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
