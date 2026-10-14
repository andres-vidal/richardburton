defmodule RichardBurtonWeb.Actor do
  @moduledoc """
  Names the user who made a request, for the history entries that the request
  records. Controllers import `actor/1`.
  """

  alias RichardBurton.User

  @doc """
  Returns the email of the signed-in user. The authentication plug assigns the
  user's id as `subject_id`.
  """
  def actor(conn), do: User.get(conn.assigns.subject_id).email
end
