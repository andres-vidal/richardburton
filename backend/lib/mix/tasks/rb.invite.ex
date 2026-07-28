defmodule Mix.Tasks.Rb.Invite do
  @shortdoc "Offers a role to an email address from the console"

  @moduledoc """
  Records an invitation without going through the dashboard.

  An account is made only for someone who was invited, which leaves a fresh
  database with nobody who can invite anyone — this is the way in. Invite
  yourself, sign in with that address, and the role is waiting; from then on the
  dashboard does this.

  It is the same mechanism the dashboard uses, so the first admin arrives the
  way everyone else does, and the log says who let them in.

      mix rb.invite someone@example.com admin
      mix rb.invite someone@example.com          # contributor

  Mail is attempted and a failure is reported, not fatal — the invitation stands
  either way, and can be sent again from the dashboard.
  """

  use Mix.Task

  alias RichardBurton.Invitation

  @impl Mix.Task
  def run(args) do
    Mix.Task.run("app.start")

    case args do
      [email] -> invite(email, "contributor")
      [email, role] -> invite(email, role)
      _ -> Mix.shell().error("Usage: mix rb.invite EMAIL [reader|contributor|admin]")
    end
  end

  defp invite(email, role) do
    case Invitation.invite(%{"email" => email, "role" => role}) do
      {:ok, {:invited, invitation}} ->
        Mix.shell().info("Invited #{invitation.email} as #{invitation.role}.")

      {:ok, {:unsent, invitation}} ->
        Mix.shell().info(
          "Invited #{invitation.email} as #{invitation.role}, but the mail could not be sent. " <>
            "They can sign in with that address regardless."
        )

      {:ok, {:granted, user}} ->
        Mix.shell().info("#{user.email} already had an account and is now #{user.role}.")

      {:error, :conflict} ->
        Mix.shell().error("#{email} already has an invitation waiting.")

      {:error, errors} ->
        Mix.shell().error("Could not invite #{email}: #{inspect(errors)}")
    end
  end
end
