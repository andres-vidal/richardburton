defmodule RichardBurtonWeb.Actor do
  @moduledoc """
  Names the user who made a request, as the actor of the history entries the
  request records.
  """

  alias RichardBurton.User

  @doc """
  Returns the email of the signed-in user. It reads the user's id from the
  `subject_id` that an authentication plug assigned.
  """
  def actor(conn), do: User.get(conn.assigns.subject_id).email
end
