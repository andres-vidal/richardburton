defmodule RichardBurton.Auth.Access do
  @moduledoc """
  Broadcasts that a person's access may have changed, on a PubSub topic for
  that person.

  `topic/1` names the topic, and `changed/1` broadcasts `:access_changed` on
  it. The message does not say what changed. A subscriber reads the current
  state from the database when it receives one, so the order of the messages
  does not matter, and an extra message costs only one more read.

  Call `changed/1` after the change is committed. A subscriber reads on its own
  database connection, so it cannot see the change until the transaction that
  makes it commits.
  """

  @pubsub RichardBurton.PubSub

  @doc "The PubSub topic for a person's access changes."
  def topic(subject_id), do: "access:#{subject_id}"

  @doc """
  Broadcasts `:access_changed` on the topic of the person with `subject_id`.
  Call it after the change is committed.
  """
  def changed(subject_id) do
    Phoenix.PubSub.broadcast(@pubsub, topic(subject_id), :access_changed)
  end
end
