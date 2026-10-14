defmodule RichardBurtonWeb do
  @moduledoc """
  The entrypoint for defining your web interface, such
  as controllers, channels and so on.

  This can be used in your application as:

      use RichardBurtonWeb, :controller

  The definitions below will be executed for every controller,
  router, etc, so keep them short and clean, focused
  on imports, uses and aliases.

  Do NOT define functions inside the quoted expressions
  below. Instead, define any helper function in modules
  and import those modules here.
  """

  @doc """
  Returns the definition of a JSON controller. It imports `found/1` and
  `actor/1`, aliases `RichardBurtonWeb.Params`, and sends the errors an action
  returns to `RichardBurtonWeb.FallbackController`.
  """
  def controller do
    quote do
      use Phoenix.Controller, formats: [:json]

      import Plug.Conn
      import RichardBurtonWeb.FallbackController, only: [found: 1]
      import RichardBurtonWeb.Actor, only: [actor: 1]

      alias RichardBurtonWeb.Params

      action_fallback(RichardBurtonWeb.FallbackController)
    end
  end

  @doc "Returns the definition of the router."
  def router do
    quote do
      use Phoenix.Router

      import Plug.Conn
      import Phoenix.Controller
    end
  end

  @doc "Returns the definition of a channel."
  def channel do
    quote do
      use Phoenix.Channel
    end
  end

  @doc """
  When used, dispatch to the appropriate controller/router/channel.
  """
  defmacro __using__(which) when is_atom(which) do
    apply(__MODULE__, which, [])
  end
end
