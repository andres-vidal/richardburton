defmodule RichardBurton.Auth.Access do
  @moduledoc """
  Saying that somebody's access has changed, for whatever holds it open.

  A request is authorised as it arrives, so a change reaches the next one
  without anyone saying so. A live connection is authorised when it opens and
  then held, so it has to be told. The functions that change access — revoking
  one session, revoking all of someone's, changing their role — announce it
  here, once, and whatever is holding a connection for that person checks
  again. No caller has to remember to close anything.

  The announcement says only that something changed, not what. A listener
  re-reads the current state rather than trusting a message about it, so the
  order announcements arrive in cannot leave it with a stale answer.
  """

  @pubsub RichardBurton.PubSub

  @doc "The topic a person's access changes are announced on."
  def topic(subject_id), do: "access:#{subject_id}"

  @doc "Say that this person's access may have changed."
  def changed(subject_id) do
    Phoenix.PubSub.broadcast(@pubsub, topic(subject_id), :access_changed)
  end
end
