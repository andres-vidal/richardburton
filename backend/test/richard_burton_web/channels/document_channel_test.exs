defmodule RichardBurtonWeb.DocumentChannelTest do
  @moduledoc """
  Tests for the socket and channel import documents are edited live over: who
  gets on, who stays on, who is seen to be here, and what crosses.

  Updates cross as the opaque bytes they are: nothing here reads one, so what
  arrives is what was sent.
  """
  use RichardBurtonWeb.ChannelCase

  import Mox

  alias RichardBurton.Auth.Session
  alias RichardBurtonWeb.DocumentChannel
  alias RichardBurtonWeb.DocumentSocket

  # The role check goes through `Auth.authorize/2`, which is a mock here the way
  # it is for the controllers. Global, because the channel asks from its own
  # process as well as from the test's. It admits by default, since most of
  # these tests are about what happens once somebody is connected.
  setup :set_mox_global
  setup :verify_on_exit!

  setup do
    stub(RichardBurton.AuthMock, :authorize, fn _, :contributor -> :ok end)
    :ok
  end

  # A real session, since whether one still stands is what the socket asks.
  defp signed_in(email) do
    user = user_fixture(email, :contributor)
    {:ok, cookie} = Session.create(user.subject_id)
    {:ok, session} = Session.verify_session(cookie)

    %{user: user, cookie: cookie, token: DocumentSocket.sign(user.subject_id, session.id)}
  end

  defp connected(%{token: token}) do
    {:ok, socket} = connect(DocumentSocket, %{}, connect_info: %{auth_token: token})
    socket
  end

  defp joined(person, document) do
    {:ok, _reply, socket} =
      person |> connected() |> subscribe_and_join(DocumentChannel, "document:#{document.id}")

    socket
  end

  defp document, do: document_fixture()

  describe "connecting" do
    test "somebody signed in who may keep the database is let on" do
      person = signed_in("helen@example.com")

      assert {:ok, socket} =
               connect(DocumentSocket, %{}, connect_info: %{auth_token: person.token})

      assert socket.assigns.subject_id == person.user.subject_id
    end

    # The token travels in a header. One in the query string would be in every
    # request log the connection passes through.
    test "a token passed as a parameter rather than a header is not accepted" do
      person = signed_in("helen@example.com")

      assert :error = connect(DocumentSocket, %{"token" => person.token})
    end

    test "somebody whose role does not reach the documents is refused" do
      person = signed_in("helen@example.com")
      stub(RichardBurton.AuthMock, :authorize, fn _, :contributor -> :error end)

      assert :error = connect(DocumentSocket, %{}, connect_info: %{auth_token: person.token})
    end

    test "a token for a session that has been signed out of is refused" do
      person = signed_in("helen@example.com")
      Session.revoke(person.cookie)

      assert :error = connect(DocumentSocket, %{}, connect_info: %{auth_token: person.token})
    end

    test "no token, no connection" do
      assert :error = connect(DocumentSocket, %{})
    end

    test "something that is not a token this server signed is refused" do
      assert :error = connect(DocumentSocket, %{}, connect_info: %{auth_token: "made up"})
    end
  end

  describe "joining" do
    test "anyone connected may join any document" do
      # The list is shared, so being connected is the whole permission.
      assert {:ok, _reply, _socket} =
               signed_in("helen@example.com")
               |> connected()
               |> subscribe_and_join(DocumentChannel, "document:#{document().id}")
    end

    test "a document that does not exist cannot be joined" do
      assert {:error, %{reason: "not_found"}} =
               signed_in("helen@example.com")
               |> connected()
               |> subscribe_and_join(DocumentChannel, "document:999999")
    end

    test "a socket whose session has since gone cannot join anything" do
      person = signed_in("helen@example.com")
      socket = connected(person)
      Session.revoke(person.cookie)

      assert {:error, %{reason: "refused"}} =
               subscribe_and_join(socket, DocumentChannel, "document:#{document().id}")
    end
  end

  describe "presence" do
    test "whoever joins is sent who is already here" do
      document = document()
      joined(signed_in("helen@example.com"), document)
      # Helen was first, so she was sent nobody.
      assert_push("presence_state", %{})

      joined(signed_in("isabel@example.com"), document)

      assert_push("presence_state", state)
      assert state |> Map.values() |> Enum.any?(&has_email?(&1, "helen@example.com"))
    end

    # The address comes from the account the socket was authenticated as, so
    # nobody's presence rests on what their own connection claims about them.
    test "everyone else hears of somebody arriving, by the address the server holds" do
      document = document()
      joined(signed_in("helen@example.com"), document)
      # Helen's own arrival, which is not the one this is about.
      assert_broadcast("presence_diff", _)

      {:ok, _reply, _socket} =
        signed_in("isabel@example.com")
        |> connected()
        |> subscribe_and_join(DocumentChannel, "document:#{document.id}", %{"clientId" => 42})

      assert_broadcast("presence_diff", %{joins: joins})
      assert joins |> Map.values() |> Enum.any?(&has_client?(&1, 42, "isabel@example.com"))
    end

    test "a connection that closes is gone from the room" do
      document = document()
      person = signed_in("helen@example.com")
      socket = joined(person, document)
      assert_broadcast("presence_diff", %{joins: _})

      Process.unlink(socket.channel_pid)
      leave(socket)

      assert_broadcast("presence_diff", %{leaves: leaves})
      assert Map.has_key?(leaves, person.user.subject_id)
    end
  end

  describe "staying on" do
    setup do
      Process.flag(:trap_exit, true)
      :ok
    end

    test "signing out closes the documents that session had open" do
      person = signed_in("helen@example.com")
      socket = joined(person, document())

      Session.revoke(person.cookie)

      assert_push("refused", %{})
      channel = socket.channel_pid
      assert_receive {:EXIT, ^channel, {:shutdown, :refused}}
    end

    # A sign-out is one session. The same person signed in somewhere else is
    # still signed in there.
    test "signing out of one session leaves the same person's other sessions alone" do
      here = signed_in("helen@example.com")
      {:ok, elsewhere_cookie} = Session.create(here.user.subject_id)
      {:ok, elsewhere_session} = Session.verify_session(elsewhere_cookie)

      elsewhere = %{
        token: DocumentSocket.sign(here.user.subject_id, elsewhere_session.id)
      }

      document = document()
      joined(here, document)
      kept = joined(elsewhere, document)

      Session.revoke(here.cookie)

      assert_receive {:EXIT, _pid, {:shutdown, :refused}}
      kept_channel = kept.channel_pid
      refute_receive {:EXIT, ^kept_channel, _}, 100
    end

    test "losing the role closes every document the person has open" do
      person = signed_in("helen@example.com")
      socket = joined(person, document())

      stub(RichardBurton.AuthMock, :authorize, fn _, :contributor -> :error end)
      RichardBurton.User.set_role(person.user, :reader)

      assert_push("refused", %{})
      channel = socket.channel_pid
      assert_receive {:EXIT, ^channel, {:shutdown, :refused}}
    end
  end

  describe "relaying" do
    setup do
      {:ok, socket: joined(signed_in("helen@example.com"), document())}
    end

    test "a change reaches the others, as the bytes it was sent as", meta do
      push(meta.socket, "update", %{"update" => "AQIDBA=="})

      assert_broadcast("update", %{"update" => "AQIDBA=="})
    end

    test "awareness crosses the same way", meta do
      push(meta.socket, "awareness", %{"awareness" => "BQY="})

      assert_broadcast("awareness", %{"awareness" => "BQY="})
    end

    test "a state vector crosses the same way, with whom it is from and to", meta do
      push(meta.socket, "sync", %{"state" => "AAE=", "from" => 7, "to" => 42})

      assert_broadcast("sync", %{"state" => "AAE=", "from" => 7, "to" => 42})
    end

    test "the sender is not handed back its own change", meta do
      push(meta.socket, "update", %{"update" => "AQIDBA=="})

      assert_broadcast("update", %{"update" => "AQIDBA=="})

      # Never pushed down the socket it came from, which would have the client
      # apply its own change a second time.
      refute_push("update", %{"update" => "AQIDBA=="})
    end

    test "an event it does not know is ignored rather than crashing", meta do
      push(meta.socket, "whatever", %{})

      refute_broadcast("whatever", %{})
    end
  end

  defp has_email?(%{metas: metas}, email), do: Enum.any?(metas, &(&1.email == email))

  defp has_client?(%{metas: metas}, client_id, email),
    do: Enum.any?(metas, &(&1.client_id == client_id and &1.email == email))
end
