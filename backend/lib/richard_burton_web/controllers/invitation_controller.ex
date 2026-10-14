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

  @doc "Every invitation, pending and accepted."
  def index(conn, _params) do
    json(conn, Invitation.all())
  end

  @doc """
  Offers a role to an address, as `RichardBurton.Invitation.invite/2` does.

  Responds with the `outcome`, because the three are different: someone who
  already has an account was granted the role (200, with the `user`), someone
  new has an invitation waiting (201, `invited`), or the invitation is waiting
  but could not be mailed (201, `unsent`).
  """
  def create(conn = %{assigns: %{subject_id: subject_id}}, attrs) do
    with {:ok, outcome} <- Invitation.invite(attrs, User.get(subject_id)) do
      case outcome do
        {:granted, user} ->
          conn |> put_status(:ok) |> json(%{outcome: :granted, user: user})

        {sent, invitation} ->
          conn |> put_status(:created) |> json(%{outcome: sent, invitation: invitation})
      end
    end
  end

  @doc """
  Mails a pending invitation again. A mail that could not be sent is a 502
  with `unsent`, and an invitation already accepted a 409 with `accepted`.
  """
  def resend(conn, %{"id" => id}) do
    with {:ok, id} <- Params.id(id),
         {:ok, invitation} <- found(Invitation.get(id)),
         {:ok, sent} <- Invitation.resend(invitation) do
      json(conn, sent)
    end
  end

  @doc """
  Withdraws a pending invitation. An invitation already accepted is a 409 with
  `accepted`.
  """
  def delete(conn, %{"id" => id}) do
    with {:ok, id} <- Params.id(id),
         {:ok, invitation} <- found(Invitation.get(id)),
         {:ok, _cancelled} <- Invitation.cancel(invitation) do
      send_resp(conn, :no_content, "")
    end
  end
end
