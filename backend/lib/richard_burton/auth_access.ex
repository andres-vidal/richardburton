defmodule RichardBurton.Auth.Access do
  @moduledoc """
  Tells a person's open document channels that their access has changed.

  An HTTP request checks access every time it arrives, so it sees a change on
  its own. A channel checks access only when it is joined, so it has to be
  told. `changed/1` broadcasts on the person's access topic. It is called when
  a session is revoked, when all of a person's sessions are revoked, and when
  their role changes. Each of their open channels then checks access again and
  closes if it is no longer allowed.

  The broadcast does not say what changed. A channel reads the current state
  when it hears one, so the order in which broadcasts arrive does not matter.
  """

  @pubsub RichardBurton.PubSub

  @doc "The PubSub topic for a person's access changes."
  def topic(subject_id), do: "access:#{subject_id}"

  @doc "Broadcasts that a person's access may have changed."
  def changed(subject_id) do
    Phoenix.PubSub.broadcast(@pubsub, topic(subject_id), :access_changed)
  end
end
