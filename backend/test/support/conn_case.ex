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

  Each test gets a `conn` signed in as the **session user**: it carries an
  `rb-session` cookie for a real session of that user's subject, the matching
  `rb-csrf-token` header, and an `Authorization: Bearer` header for the routes
  that take a provider token. `Phoenix.ConnTest.build_conn/0` gives a
  connection without any of this.

  The session user's row is inserted only for a test tagged with a `:role`,
  such as `@tag role: :admin`, or `@describetag` or `@moduletag` for a group of
  tests. The row holds that role, and the test's context holds the row under
  `:session_user`. Without the tag, `:session_user` is nil and the role checks
  refuse the session user.

  The provider-token and reCAPTCHA checks go through `RichardBurton.AuthMock`
  and `RichardBurton.Auth.RecaptchaMock`, which the `expect_auth_*` helpers
  program.
  """

  use ExUnit.CaseTemplate
  import Mox

  @session_subject_id "12345"
  @session_user_email "admin@richardburton.test"

  using do
    quote do
      # Import conveniences for testing with connections
      import Plug.Conn
      import Phoenix.ConnTest
      import RichardBurton.Fixtures
      import RichardBurtonWeb.ConnCase

      alias RichardBurtonWeb.Router.Helpers, as: Routes

      # The default endpoint for testing
      @endpoint RichardBurtonWeb.Endpoint
    end
  end

  setup tags do
    RichardBurton.DataCase.setup_sandbox(tags)
    {:ok, conn: signed_in_conn(), session_user: tags[:role] && insert_session_user(tags[:role])}
  end

  setup :verify_on_exit!

  # Returns a connection signed in as the session user, as the module doc
  # describes.
  defp signed_in_conn do
    {:ok, token} = RichardBurton.Auth.Session.create(@session_subject_id)

    Phoenix.ConnTest.build_conn()
    |> Plug.Test.put_req_cookie(RichardBurton.Auth.Session.cookie_name(), token)
    |> Plug.Conn.put_req_header("authorization", "Bearer token")
    |> Plug.Conn.put_req_header(
      RichardBurton.Auth.Csrf.header_name(),
      RichardBurton.Auth.Csrf.sign(@session_subject_id)
    )
  end

  @doc "Returns the params of a request that uploads the file at `path` as `csv`."
  def uploaded_csv_fixture(path) do
    %{"csv" => %Plug.Upload{path: path, filename: "file"}}
  end

  @doc "Returns the subject id of the session user."
  def session_subject_id, do: @session_subject_id

  @doc "Returns the email of the session user."
  def session_user_email, do: @session_user_email

  # Inserts the session user with `role`, and returns it.
  defp insert_session_user(role) do
    RichardBurton.Repo.insert!(%RichardBurton.User{
      subject_id: @session_subject_id,
      email: @session_user_email,
      role: role
    })
  end

  @doc """
  Expects `n` calls of `Auth.verify/1`, each of which vouches for the session
  user's subject with the address `email`.
  """
  def expect_auth_verify(n \\ 1, email \\ @session_user_email) do
    expect(RichardBurton.AuthMock, :verify, n, fn _ ->
      {:ok, %{subject_id: @session_subject_id, email: email}}
    end)
  end

  @doc "Expects `n` reCAPTCHA checks, each of which passes."
  def expect_auth_recaptcha_verify(n \\ 1) do
    expect(RichardBurton.Auth.RecaptchaMock, :verify, n, fn _ -> :ok end)
  end

  @doc """
  Runs `fun`, and returns its result and how many of the queries the calling
  process ran meanwhile read the `search_keywords` view.
  """
  def counting_keyword_lookups(fun) do
    RichardBurton.DataCase.count_queries(fun, &(&1 =~ "search_keywords"))
  end
end
