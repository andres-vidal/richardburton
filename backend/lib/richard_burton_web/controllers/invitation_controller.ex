defmodule RichardBurtonWeb.InvitationController do
  @moduledoc """
  Invitations: offering a role to an address, listing what is outstanding,
  resending, and withdrawing.

  An invitation is redeemed by signing in with the address it names, so nothing
  here creates an account.
  """

  use RichardBurtonWeb, :controller

  alias RichardBurton.Invitation
  alias RichardBurton.User

  @doc "Every invitation — the ones waiting, and the ones taken up."
  def index(conn, _params) do
    json(conn, Invitation.all())
  end

  @doc """
  Offer a role to an address.

  Answers with what happened, because the three outcomes are genuinely
  different: someone already here was granted the role, someone new has an
  invitation waiting, or they have one waiting that could not be mailed to them.
  """
  def create(conn = %{assigns: %{subject_id: subject_id}}, attrs) do
    case Invitation.invite(attrs, User.get(subject_id)) do
      {:ok, {:granted, user}} ->
        conn |> put_status(:ok) |> json(%{outcome: :granted, user: user})

      {:ok, {:invited, invitation}} ->
        conn |> put_status(:created) |> json(%{outcome: :invited, invitation: invitation})

      {:ok, {:unsent, invitation}} ->
        conn |> put_status(:created) |> json(%{outcome: :unsent, invitation: invitation})

      # That address is already waiting on an offer.
      {:error, :conflict} ->
        {:error, :pending}

      # Every other error goes to `FallbackController`. Inviting yourself would
      # change your own role, so it fails with `:self`, like any other change to
      # your own role.
      error ->
        error
    end
  end

  @doc "Send a pending invitation's mail again."
  def resend(conn, %{"id" => id}) do
    with {:ok, invitation} <- found(Invitation.get(id)) do
      case Invitation.resend(invitation) do
        {:ok, sent} -> json(conn, sent)
        {:error, :already_accepted} -> {:error, :accepted}
        # The mailer failed to send the mail. Any reason it gives is a 502.
        {:error, _reason} -> {:error, :bad_gateway, :unsent}
      end
    end
  end

  @doc "Withdraw a pending invitation."
  def delete(conn, %{"id" => id}) do
    with {:ok, invitation} <- found(Invitation.get(id)) do
      case Invitation.cancel(invitation) do
        {:ok, _cancelled} -> send_resp(conn, :no_content, "")
        {:error, :already_accepted} -> {:error, :accepted}
      end
    end
  end
end
