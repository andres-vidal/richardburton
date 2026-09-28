defmodule RichardBurtonWeb.Presence do
  @moduledoc """
  Who has an import document open, as the server knows it.

  Each open connection is tracked under the person it was authenticated as, and
  carries the address the server holds for them. A connection that closes, or
  whose process dies without closing cleanly, is untracked by Phoenix itself,
  and the leave is broadcast to everyone still there.
  """

  use Phoenix.Presence,
    otp_app: :richard_burton,
    pubsub_server: RichardBurton.PubSub
end
