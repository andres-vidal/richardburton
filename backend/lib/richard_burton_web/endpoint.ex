defmodule RichardBurtonWeb.Endpoint do
  @moduledoc """
  The HTTP entry point: the socket, the static and parsing plugs, and the
  session the `rb-session` cookie is carried in.
  """

  use Phoenix.Endpoint, otp_app: :richard_burton

  # The session will be stored in the cookie and signed,
  # this means its contents can be read but not tampered with.
  # Set :encryption_salt if you would also like to encrypt it.
  @session_options [
    store: :cookie,
    key: "_richard_burton_key",
    signing_salt: "c2iQDmVV"
  ]

  socket("/live", Phoenix.LiveView.Socket, websocket: [connect_info: [session: @session_options]])

  # The document socket reads the `rb-session` cookie on connect, through
  # `RichardBurtonWeb.SessionCookie`, and accepts long-polling as well as
  # WebSockets.
  #
  # Phoenix's CSRF check is off on both transports, because it expects the CSRF
  # token of a Plug session. `RichardBurtonWeb.DocumentSocket` checks the app's
  # own CSRF token instead, and the origin check stays on.
  #
  # Both transports take the CSRF token in the auth-token header instead of the
  # query string, so it does not appear in request logs. `auth_token` is set
  # once for the socket, not on each transport, because Phoenix copies the
  # socket-wide value into both transports and would overwrite a per-transport
  # one.
  @document_session [
    store: RichardBurtonWeb.SessionCookie,
    key: RichardBurton.Auth.Session.cookie_name()
  ]

  socket("/socket", RichardBurtonWeb.DocumentSocket,
    websocket: [connect_info: [session: @document_session], check_csrf: false],
    longpoll: [connect_info: [session: @document_session], check_csrf: false],
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
    # CORSPlug's default allow-headers list, plus our custom rb-csrf-token so the
    # double-submit header survives the preflight once a csrf-token cookie exists.
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
