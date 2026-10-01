defmodule RichardBurton.Auth.Access do
  @moduledoc """
  Tells a person's open document channels that their access has changed.

  An HTTP request checks access every time it arrives, so it sees a change on
  its own. A channel checks access only when it is joined, so it has to be
  told. `changed/1` broadcasts on the person's access topic. It is called when
  a session is revoked, when all of a person's sessions are revoked, when their
  account is deleted, and when their role changes. Each of their open channels
  then checks access again and closes if it is no longer allowed.

  The broadcast does not say what changed. A channel reads the current state
  when it hears one, so the order in which broadcasts arrive does not matter,
  and an extra broadcast only costs each channel one more check.

  Call `changed/1` after the change is committed. Each channel checks access
  on its own database connection, so it cannot see the change until the
  transaction commits. If `changed/1` is called inside the transaction, the
  channels check too early, find that access is still allowed, and stay open.
  When a function that calls `changed/1` runs inside a caller's transaction,
  the caller must call it again after the commit, as
  `RichardBurton.User.delete/2` does.
  """

  @pubsub RichardBurton.PubSub

  @doc "The PubSub topic for a person's access changes."
  def topic(subject_id), do: "access:#{subject_id}"

  @doc "Broadcasts that a person's access may have changed. Call it after the change is committed."
  def changed(subject_id) do
    Phoenix.PubSub.broadcast(@pubsub, topic(subject_id), :access_changed)
  end
end
