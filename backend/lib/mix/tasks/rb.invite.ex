defmodule Mix.Tasks.Rb.Invite do
  @shortdoc "Offers a role to an email address from the console"

  @moduledoc """
  Offers a role to an email address, as `RichardBurton.Invitation.invite/2`
  does, and prints what happened.

  An account is made only for someone who was invited, so a new database has
  nobody who can invite anyone. This task makes the first invitation: invite
  yourself as an admin, then sign in with that address.

      mix rb.invite someone@example.com admin
      mix rb.invite someone@example.com          # contributor

  When the mail cannot be sent, the task says so and the invitation is kept.
  The address can be used to sign in either way.
  """

  use Mix.Task

  alias RichardBurton.Invitation
  alias RichardBurton.User
  alias RichardBurton.Validation

  @impl Mix.Task
  def run(args) do
    Mix.Task.run("app.start")

    case args do
      [email] -> invite(email, "contributor")
      [email, role] -> invite(email, role)
      _ -> Mix.shell().error("Usage: mix rb.invite EMAIL [reader|contributor|admin]")
    end
  end

  # Invites `email` as `role`, and prints the outcome or the reason it failed.
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

      {:error, :pending} ->
        Mix.shell().error("#{email} already has an invitation waiting.")

      {:error, :invalid_role} ->
        Mix.shell().error("#{role} is not a role. Try #{Enum.join(User.roles(), ", ")}.")

      {:error, changeset = %Ecto.Changeset{}} ->
        Mix.shell().error(
          "Could not invite #{email}: #{inspect(Validation.get_errors(changeset))}"
        )

      {:error, reason} ->
        Mix.shell().error("Could not invite #{email}: #{inspect(reason)}")
    end
  end
end
