defmodule RichardBurtonWeb.DocumentChannelTest do
  @moduledoc """
  Tests for the channel import documents are edited live over.

  Updates cross as the opaque bytes they are: nothing here reads one, so what
  arrives is what was sent.
  """
  use RichardBurtonWeb.ChannelCase

  alias RichardBurton.Document
  alias RichardBurtonWeb.DocumentChannel
  alias RichardBurtonWeb.DocumentSocket

  defp connected do
    {:ok, socket} = connect(DocumentSocket, %{"token" => DocumentSocket.sign("somebody")})

    socket
  end

  defp document do
    {:ok, document} = Document.create(%{"name" => "Second pass"})
    document
  end

  describe "connecting" do
    test "a token this server signed gets you on" do
      assert {:ok, socket} =
               connect(DocumentSocket, %{"token" => DocumentSocket.sign("somebody")})

      assert socket.assigns.subject_id == "somebody"
    end

    test "no token, no connection" do
      assert :error = connect(DocumentSocket, %{})
    end

    test "something that is not a token this server signed is refused" do
      assert :error = connect(DocumentSocket, %{"token" => "made up"})
    end
  end

  describe "joining" do
    test "anyone connected may join any document" do
      # The list is shared, so being connected is the whole permission.
      document = document()

      assert {:ok, _reply, _socket} =
               connected() |> subscribe_and_join(DocumentChannel, "document:#{document.id}")
    end

    test "a document that does not exist cannot be joined" do
      assert {:error, %{reason: "not_found"}} =
               connected() |> subscribe_and_join(DocumentChannel, "document:999999")
    end
  end

  describe "relaying" do
    setup do
      {:ok, _reply, socket} =
        connected() |> subscribe_and_join(DocumentChannel, "document:#{document().id}")

      {:ok, socket: socket}
    end

    test "a change reaches the others, as the bytes it was sent as", meta do
      push(meta.socket, "update", %{"update" => "AQIDBA=="})

      assert_broadcast("update", %{"update" => "AQIDBA=="})
    end

    test "awareness crosses the same way", meta do
      push(meta.socket, "awareness", %{"awareness" => "BQY="})

      assert_broadcast("awareness", %{"awareness" => "BQY="})
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
end
