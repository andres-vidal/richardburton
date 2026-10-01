defmodule RichardBurtonWeb.Presence do
  @moduledoc """
  Tracks who has each import document open.

  `RichardBurtonWeb.DocumentChannel` tracks each joined connection under the
  `subject_id` the socket authenticated, with the person's email address and
  the connection's `client_id`. When a connection closes, or its process dies
  without closing cleanly, Phoenix untracks it and broadcasts the leave to the
  other connections on the document.
  """

  use Phoenix.Presence,
    otp_app: :richard_burton,
    pubsub_server: RichardBurton.PubSub
end
