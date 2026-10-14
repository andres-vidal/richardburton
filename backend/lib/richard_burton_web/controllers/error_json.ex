defmodule RichardBurtonWeb.ErrorJSON do
  @moduledoc """
  Renders the errors the endpoint raises, such as an unknown route or a crash,
  as a JSON body that holds the status text alone, like
  `%{errors: %{detail: "Not Found"}}`.
  """

  @doc """
  Returns the body for `template`, which names the status and the format, such
  as `"404.json"`.
  """
  def render(template, _assigns) do
    %{errors: %{detail: Phoenix.Controller.status_message_from_template(template)}}
  end
end
