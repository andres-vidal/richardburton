defmodule RichardBurtonWeb.Endpoint do
  @moduledoc """
  The HTTP entry point: the sockets, and the plugs every request goes through
  before the router, such as request parsing and CORS.
  """

  use Phoenix.Endpoint, otp_app: :richard_burton

  # The session will be stored in the cookie and signed,
  # this means its contents can be read but not tampered with.
  # Set :encryption_salt if you would also like to encrypt it.
  # The LiveDashboard and its socket use it; the app's own sign-in does not
  # (see `RichardBurtonWeb.SignInCookies`).
  @session_options [
    store: :cookie,
    key: "_richard_burton_key",
    signing_salt: "c2iQDmVV"
  ]

  socket("/live", Phoenix.LiveView.Socket, websocket: [connect_info: [session: @session_options]])

  # The document socket accepts WebSocket connections only. It reads the
  # `rb-session` cookie on connect, through `RichardBurtonWeb.SessionCookie`.
  #
  # Phoenix's CSRF check is off, because it expects the CSRF token of a Plug
  # session. `RichardBurtonWeb.DocumentSocket` checks the app's own CSRF token
  # instead, and the origin check stays on.
  #
  # The CSRF token comes in the auth-token header instead of the query string,
  # so it does not appear in request logs.
  @document_session [
    store: RichardBurtonWeb.SessionCookie,
    key: RichardBurton.Auth.Session.cookie_name()
  ]

  socket("/socket", RichardBurtonWeb.DocumentSocket,
    websocket: [connect_info: [session: @document_session], check_csrf: false],
    auth_token: true
  )

  # Serve at "/" the static files from "priv/static" directory.
  #
  # You should set gzip to true if you are running phx.digest
  # when deploying your static files in production.
  plug(Plug.Static,
    at: "/",
    from: :richard_burton,
    gzip: false,
    only: ~w(assets fonts images favicon.ico robots.txt)
  )

  # Code reloading can be explicitly enabled under the
  # :code_reloader configuration of your endpoint.
  if code_reloading? do
    plug(Phoenix.CodeReloader)
    plug(Phoenix.Ecto.CheckRepoStatus, otp_app: :richard_burton)
  end

  plug(Phoenix.LiveDashboard.RequestLogger,
    param_key: "request_logger",
    cookie_key: "request_logger"
  )

  plug(Plug.RequestId)
  plug(Plug.Telemetry, event_prefix: [:phoenix, :endpoint])

  plug(Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    json_decoder: Phoenix.json_library()
  )

  plug(Plug.MethodOverride)
  plug(Plug.Head)
  plug(Plug.Session, @session_options)

  plug(CORSPlug,
    origin: &RichardBurton.Application.origin/0,
    credentials: Application.compile_env(:richard_burton, :phx_cors_credentials, false),
    expose: ["content-disposition", RichardBurton.Publication.Index.count_header()],
    # The default headers of CORSPlug, and the CSRF token header that
    # `RichardBurtonWeb.Plugs.VerifyCsrf` reads.
    headers: [
      "Authorization",
      "Content-Type",
      "Accept",
      "Origin",
      "User-Agent",
      "DNT",
      "Cache-Control",
      "X-Mx-ReqToken",
      "Keep-Alive",
      "X-Requested-With",
      "If-Modified-Since",
      RichardBurton.Auth.Csrf.header_name()
    ]
  )

  plug(RichardBurtonWeb.Router)
end
