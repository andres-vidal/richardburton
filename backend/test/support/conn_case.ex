defmodule RichardBurtonWeb.ConnCase do
  @moduledoc """
  This module defines the test case to be used by
  tests that require setting up a connection.

  Such tests rely on `Phoenix.ConnTest` and also
  import other functionality to make it easier
  to build common data structures and query the data layer.

  Finally, if the test case interacts with the database,
  we enable the SQL sandbox, so changes done to the database
  are reverted at the end of every test. If you are using
  PostgreSQL, you can even run database tests asynchronously
  by setting `use RichardBurtonWeb.ConnCase, async: true`, although
  this option is not recommended for other databases.
  """

  use ExUnit.CaseTemplate
  import Mox

  using do
    quote do
      # Import conveniences for testing with connections
      import Plug.Conn
      import Phoenix.ConnTest
      import RichardBurtonWeb.ConnCase

      alias RichardBurtonWeb.Router.Helpers, as: Routes

      # The default endpoint for testing
      @endpoint RichardBurtonWeb.Endpoint
    end
  end

  setup tags do
    RichardBurton.DataCase.setup_sandbox(tags)
    {:ok, conn: build_conn()}
  end

  setup :verify_on_exit!

  defp build_conn do
    Phoenix.ConnTest.build_conn() |> Plug.Conn.put_req_header("authorization", "Bearer token")
  end

  def uploaded_file_fixture(path) do
    %Plug.Upload{path: path, filename: "file"}
  end

  def uploaded_csv_fixture(path) do
    %{"csv" => uploaded_file_fixture(path)}
  end

  def expect_auth_verify(n \\ 1) do
    expect(RichardBurton.AuthMock, :verify, n, fn _ -> {:ok, "12345"} end)
  end

  def expect_auth_authorize_admin(n \\ 1) do
    expect_auth_verify(n)
    expect(RichardBurton.AuthMock, :authorize, n, fn _, :admin -> :ok end)
  end

  def expect_auth_recaptcha_verify(n \\ 1) do
    expect(RichardBurton.Auth.RecaptchaMock, :verify, n, fn _ -> :ok end)
  end

  def expect_mailer_send(n \\ 1) do
    expect(RichardBurton.MailerMock, :send, n, fn _ -> {:ok, "Whatever"} end)
  end

  def mock_admin_logged_in(_context) do
    RichardBurton.AuthMock
    |> expect(:verify, fn _ -> {:ok, "admin-token"} end)
    |> expect(:authorize, fn _, :admin -> :ok end)

    %{}
  end
end
