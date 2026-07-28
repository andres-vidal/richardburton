defmodule RichardBurtonWeb.InvitationController do
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

      {:error, :last_admin} ->
        conn |> put_status(:conflict) |> json(%{error: :last_admin})

      # Inviting yourself is a way of changing your own role, and that is
      # refused wherever it is asked for.
      {:error, :self} ->
        conn |> put_status(:conflict) |> json(%{error: :self})

      {:error, :invalid_role} ->
        conn |> put_status(:bad_request) |> json(%{error: :invalid_role})

      # That address is already waiting on an offer.
      {:error, :conflict} ->
        conn |> put_status(:conflict) |> json(%{error: :pending})

      {:error, errors} ->
        conn |> put_status(:bad_request) |> json(%{errors: errors})
    end
  end

  @doc "Send a pending invitation's mail again."
  def resend(conn, %{"id" => id}) do
    with invitation = %Invitation{} <- Invitation.get(id),
         {:ok, sent} <- Invitation.resend(invitation) do
      json(conn, sent)
    else
      nil -> conn |> put_status(:not_found) |> json(%{error: :not_found})
      {:error, :already_accepted} -> conn |> put_status(:conflict) |> json(%{error: :accepted})
      {:error, _reason} -> conn |> put_status(:bad_gateway) |> json(%{error: :unsent})
    end
  end

  @doc "Withdraw a pending invitation."
  def delete(conn, %{"id" => id}) do
    with invitation = %Invitation{} <- Invitation.get(id),
         {:ok, _cancelled} <- Invitation.cancel(invitation) do
      send_resp(conn, :no_content, "")
    else
      nil -> conn |> put_status(:not_found) |> json(%{error: :not_found})
      {:error, :already_accepted} -> conn |> put_status(:conflict) |> json(%{error: :accepted})
    end
  end
end
