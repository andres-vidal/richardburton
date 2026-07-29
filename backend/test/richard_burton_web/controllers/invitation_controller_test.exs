defmodule RichardBurtonWeb.InvitationControllerTest do
  @moduledoc """
  Tests for the invitation controller
  """
  use RichardBurtonWeb.ConnCase
  import Routes, only: [invitation_path: 2, invitation_path: 3]

  alias RichardBurton.Invitation
  alias RichardBurton.User

  describe "POST /invitations" do
    test "offers a role to someone who has never signed in", %{conn: conn} do
      create_session_user()
      expect_auth_authorize_admin()
      expect_mailer_send()

      conn =
        post(conn, invitation_path(conn, :create), %{
          "email" => "new@example.com",
          "role" => "contributor"
        })

      assert %{"outcome" => "invited", "invitation" => invitation} = json_response(conn, 201)
      assert invitation["email"] == "new@example.com"
      assert invitation["role"] == "contributor"
    end

    test "grants it outright to someone already here", %{conn: conn} do
      create_session_user()
      {:ok, _} = User.insert(%{"subject_id" => "sub-here", "email" => "here@example.com"})
      expect_auth_authorize_admin()

      conn =
        post(conn, invitation_path(conn, :create), %{
          "email" => "here@example.com",
          "role" => "admin"
        })

      assert %{"outcome" => "granted", "user" => user} = json_response(conn, 200)
      assert user["role"] == "admin"
    end

    # The role is granted by the record, not by the mail, so a mail that fails
    # must not lose it — it is reported so the dashboard can offer to resend.
    test "says so when the invitation stands but could not be mailed", %{conn: conn} do
      create_session_user()
      expect_auth_authorize_admin()
      refuse_mailer_send()

      conn =
        post(conn, invitation_path(conn, :create), %{
          "email" => "new@example.com",
          "role" => "reader"
        })

      assert %{"outcome" => "unsent"} = json_response(conn, 201)
    end

    # Inviting yourself is a way of changing your own role, so it meets the same
    # refusal the dashboard's role menu does.
    test "refuses an admin their own address", %{conn: conn} do
      me = create_session_user()
      expect_auth_authorize_admin()

      conn =
        post(conn, invitation_path(conn, :create), %{
          "email" => session_user_email(),
          "role" => "admin"
        })

      assert %{"error" => "self"} = json_response(conn, 409)
      assert User.get_by_email(session_user_email()).role == me.role
    end

    test "refuses a role that is not one", %{conn: conn} do
      create_session_user()
      user_fixture("here@example.com")
      expect_auth_authorize_admin()

      conn =
        post(conn, invitation_path(conn, :create), %{
          "email" => "here@example.com",
          "role" => "wizard"
        })

      assert %{"error" => "invalid_role"} = json_response(conn, 400)
    end

    test "refuses a second pending invitation for the same address", %{conn: conn} do
      create_session_user()
      expect_auth_authorize_admin(2)
      expect_mailer_send()

      attrs = %{"email" => "new@example.com", "role" => "reader"}
      post(conn, invitation_path(conn, :create), attrs)
      conn = post(conn, invitation_path(conn, :create), attrs)

      assert %{"error" => "pending"} = json_response(conn, 409)
    end

    test "refuses an address that is not one", %{conn: conn} do
      create_session_user()
      expect_auth_authorize_admin()

      conn =
        post(conn, invitation_path(conn, :create), %{"email" => "nope", "role" => "reader"})

      assert %{"errors" => _} = json_response(conn, 400)
    end

    test "is refused to anyone who is not an admin", %{conn: conn} do
      refuse_auth_authorize(:admin)

      conn =
        post(conn, invitation_path(conn, :create), %{"email" => "a@b.com", "role" => "admin"})

      assert response(conn, 401)
    end
  end

  describe "GET /invitations" do
    test "lists what is waiting and what was taken up", %{conn: conn} do
      create_session_user()
      expect_auth_authorize_admin()
      expect_mailer_send()
      {:ok, _} = Invitation.invite(%{"email" => "new@example.com", "role" => "reader"})

      conn = get(conn, invitation_path(conn, :index))

      assert [%{"email" => "new@example.com", "accepted_at" => nil}] = json_response(conn, 200)
    end
  end

  describe "DELETE /invitations/:id" do
    setup [:pending_invitation]

    test "withdraws a pending invitation", %{conn: conn, invitation: invitation} do
      create_session_user()
      expect_auth_authorize_admin()

      conn = delete(conn, invitation_path(conn, :delete, invitation.id))

      assert response(conn, 204)
      assert is_nil(Invitation.get(invitation.id))
    end

    test "is not found for an unknown invitation", %{conn: conn} do
      create_session_user()
      expect_auth_authorize_admin()

      conn = delete(conn, invitation_path(conn, :delete, 0))

      assert %{"error" => "not_found"} = json_response(conn, 404)
    end
  end

  describe "POST /invitations/:id/resend" do
    setup [:pending_invitation]

    test "sends a pending invitation again", %{conn: conn, invitation: invitation} do
      create_session_user()
      expect_auth_authorize_admin()
      expect_mailer_send()

      conn = post(conn, invitation_path(conn, :resend, invitation.id))

      assert %{"email" => "x@example.com"} = json_response(conn, 200)
    end

    test "is not found for an unknown invitation", %{conn: conn} do
      create_session_user()
      expect_auth_authorize_admin()

      conn = post(conn, invitation_path(conn, :resend, 0))

      assert %{"error" => "not_found"} = json_response(conn, 404)
    end
  end

  defp pending_invitation(_context) do
    expect_mailer_send()

    {:ok, {:invited, invitation}} =
      Invitation.invite(%{"email" => "x@example.com", "role" => "reader"})

    [invitation: invitation]
  end
end
