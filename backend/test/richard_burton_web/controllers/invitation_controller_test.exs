defmodule RichardBurtonWeb.InvitationControllerTest do
  @moduledoc """
  Tests for the invitation endpoints.
  """
  use RichardBurtonWeb.ConnCase
  import Routes, only: [invitation_path: 2, invitation_path: 3]
  import Swoosh.TestAssertions

  alias RichardBurton.FailingMailAdapter
  alias RichardBurton.Invitation
  alias RichardBurton.User

  @moduletag role: :admin

  describe "POST /invitations" do
    test "offers a role to someone who has never signed in", %{conn: conn} do
      conn =
        post(conn, invitation_path(conn, :create), %{
          "email" => "new@example.com",
          "role" => "contributor"
        })

      assert %{"outcome" => "invited", "invitation" => invitation} = json_response(conn, 201)
      assert invitation["email"] == "new@example.com"
      assert invitation["role"] == "contributor"
      assert_email_sent(to: "new@example.com")
    end

    test "grants it outright to someone already here", %{conn: conn} do
      {:ok, _} = User.insert(%{"subject_id" => "sub-here", "email" => "here@example.com"})

      conn =
        post(conn, invitation_path(conn, :create), %{
          "email" => "here@example.com",
          "role" => "admin"
        })

      assert %{"outcome" => "granted", "user" => user} = json_response(conn, 200)
      assert user["role"] == "admin"
    end

    # The role is granted by the invitation, not by the mail, so a mail that
    # fails does not lose it. The outcome says so, and the invitation can be
    # mailed again.
    test "says so when the invitation stands but could not be mailed", %{conn: conn} do
      FailingMailAdapter.install()

      conn =
        post(conn, invitation_path(conn, :create), %{
          "email" => "new@example.com",
          "role" => "reader"
        })

      assert %{"outcome" => "unsent"} = json_response(conn, 201)
    end

    # Inviting yourself is a way of changing your own role, so it is refused
    # the same way as `User.set_role/3` refuses it.
    test "refuses an admin their own address", %{conn: conn, session_user: me} do
      conn =
        post(conn, invitation_path(conn, :create), %{
          "email" => session_user_email(),
          "role" => "admin"
        })

      assert %{"error" => "self"} = json_response(conn, 409)
      assert User.get_by_email(session_user_email()).role == me.role
    end

    test "refuses a role that is not one, whether or not the address has an account", %{
      conn: conn
    } do
      user_fixture("here@example.com")

      for email <- ["here@example.com", "new@example.com"] do
        response =
          conn
          |> post(invitation_path(conn, :create), %{"email" => email, "role" => "wizard"})
          |> json_response(400)

        assert %{"error" => "invalid_role"} == response
      end
    end

    test "refuses a second pending invitation for the same address", %{conn: conn} do
      attrs = %{"email" => "new@example.com", "role" => "reader"}
      post(conn, invitation_path(conn, :create), attrs)
      conn = post(conn, invitation_path(conn, :create), attrs)

      assert %{"error" => "pending"} = json_response(conn, 409)
    end

    test "refuses an address that is not one", %{conn: conn} do
      conn =
        post(conn, invitation_path(conn, :create), %{"email" => "nope", "role" => "reader"})

      assert %{"errors" => %{"email" => "invalid"}} == json_response(conn, 400)
    end

    @tag role: :contributor
    test "is refused to anyone who is not an admin", %{conn: conn} do
      conn =
        post(conn, invitation_path(conn, :create), %{"email" => "a@b.com", "role" => "admin"})

      assert %{"error" => "forbidden"} == json_response(conn, 403)
    end
  end

  describe "GET /invitations" do
    test "lists what is waiting and what was taken up", %{conn: conn} do
      {:ok, _} = Invitation.invite(%{"email" => "new@example.com", "role" => "reader"})

      conn = get(conn, invitation_path(conn, :index))

      assert [%{"email" => "new@example.com", "accepted_at" => nil}] = json_response(conn, 200)
    end
  end

  describe "DELETE /invitations/:id" do
    setup [:pending_invitation]

    test "withdraws a pending invitation", %{conn: conn, invitation: invitation} do
      conn = delete(conn, invitation_path(conn, :delete, invitation.id))

      assert response(conn, 204)
      assert is_nil(Invitation.get(invitation.id))
    end

    test "refuses one already accepted, as it does sending it again", %{
      conn: conn,
      invitation: invitation
    } do
      {:ok, _} = Invitation.admit("sub-x", "x@example.com")

      assert %{"error" => "accepted"} ==
               conn |> delete(invitation_path(conn, :delete, invitation.id)) |> json_response(409)

      assert %{"error" => "accepted"} ==
               conn |> post(invitation_path(conn, :resend, invitation.id)) |> json_response(409)
    end

    test "is not found for an unknown invitation, or an id that is not a number", %{
      conn: conn
    } do
      for id <- [0, "abc"] do
        assert %{"error" => "not_found"} ==
                 conn |> delete(invitation_path(conn, :delete, id)) |> json_response(404)
      end
    end
  end

  describe "POST /invitations/:id/resend" do
    setup [:pending_invitation]

    test "sends a pending invitation again", %{conn: conn, invitation: invitation} do
      conn = post(conn, invitation_path(conn, :resend, invitation.id))

      assert %{"email" => "x@example.com"} = json_response(conn, 200)
      assert_email_sent(to: "x@example.com")
    end

    test "answers 502 unsent when the mail cannot be sent", %{conn: conn, invitation: invitation} do
      FailingMailAdapter.install()

      conn = post(conn, invitation_path(conn, :resend, invitation.id))

      assert %{"error" => "unsent"} == json_response(conn, 502)
      refute is_nil(Invitation.get(invitation.id))
    end

    test "is not found for an unknown invitation", %{conn: conn} do
      conn = post(conn, invitation_path(conn, :resend, 0))

      assert %{"error" => "not_found"} = json_response(conn, 404)
    end
  end

  # Invites x@example.com, and takes the invitation's mail out of the test
  # process's mailbox, so a test sees only the mail it sends.
  defp pending_invitation(_context) do
    {:ok, {:invited, invitation}} =
      Invitation.invite(%{"email" => "x@example.com", "role" => "reader"})

    assert_email_sent(to: "x@example.com")
    [invitation: invitation]
  end
end
