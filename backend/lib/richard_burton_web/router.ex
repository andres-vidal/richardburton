defmodule RichardBurtonWeb.Router do
  use RichardBurtonWeb, :router

  pipeline :api do
    plug(:accepts, ["json"])
  end

  pipeline :files do
    plug(:accepts, ["csv"])
  end

  pipeline :authenticate_bearer do
    plug(RichardBurtonWeb.Plugs.Authenticate.Bearer)
  end

  # Keeping the database: a contributor, or an admin, who is also one.
  pipeline :authorize_contributor do
    plug(RichardBurtonWeb.Plugs.Authenticate.Cookie)
    plug(RichardBurtonWeb.Plugs.VerifyCsrf)
    plug(RichardBurtonWeb.Plugs.Authorize, role: :contributor)
  end

  # Deciding who may keep it: an admin alone.
  pipeline :authorize_admin do
    plug(RichardBurtonWeb.Plugs.Authenticate.Cookie)
    plug(RichardBurtonWeb.Plugs.VerifyCsrf)
    plug(RichardBurtonWeb.Plugs.Authorize, role: :admin)
  end

  pipeline :authorize_recaptcha do
    plug(RichardBurtonWeb.Plugs.Authorize.Recaptcha)
  end

  # Who has access is the admin's alone; the database below is any
  # contributor's. Declared first so "/users/:id" never binds a literal path.
  scope "/api", RichardBurtonWeb do
    pipe_through(:api)
    pipe_through(:authorize_admin)

    get("/users", UserController, :index)
    patch("/users/:id", UserController, :update)
    delete("/users/:id", UserController, :delete)

    get("/invitations", InvitationController, :index)
    post("/invitations", InvitationController, :create)
    post("/invitations/:id/resend", InvitationController, :resend)
    delete("/invitations/:id", InvitationController, :delete)
  end

  # Literal paths before "/:id" ones, so "history" and "deleted" never bind as
  # ids. Routes match in declaration order *across* scopes, which is why this
  # scope comes before the public one and its "/publications/:id".
  scope "/api", RichardBurtonWeb do
    pipe_through(:api)
    pipe_through(:authorize_contributor)

    get("/authors", AuthorController, :index)
    get("/publishers", PublisherController, :index)

    scope "/publications" do
      post("/bulk", PublicationController, :create_all)
      post("/validate", PublicationController, :validate)
      get("/history", PublicationController, :history)
      get("/deleted", PublicationController, :index_deleted)
      get("/duplicates", PublicationController, :duplicates)
      post("/duplicates/distinguish", PublicationController, :distinguish)
      put("/:id", PublicationController, :update)
      delete("/:id", PublicationController, :delete)
      post("/:id/validate", PublicationController, :validate)
      post("/:id/merge", PublicationController, :merge)
      post("/:id/restore", PublicationController, :restore)
      get("/:id/history", PublicationController, :history)
      post("/:id/history/:version/undo", PublicationController, :undo)
    end
  end

  scope "/api", RichardBurtonWeb do
    pipe_through(:api)
    get("/publications", PublicationController, :index)
    get("/publications/:id", PublicationController, :show)
    get("/users/me", UserController, :me)
    delete("/sessions", SessionController, :delete)
  end

  scope "/api", RichardBurtonWeb do
    pipe_through(:api)
    pipe_through(:authorize_recaptcha)
    post("/contact", EmailController, :contact)
  end

  scope "/api", RichardBurtonWeb do
    pipe_through(:authenticate_bearer)
    post("/sessions", SessionController, :create)
  end

  scope "/api/files", RichardBurtonWeb do
    pipe_through(:files)
    pipe_through(:authorize_contributor)

    get("/publications", PublicationController, :export)
  end

  # Developer conveniences, never mounted in production: the LiveDashboard
  # (if you ever want it in production, put it behind admin authentication)
  # and the credentials provider that mints an admin session without Google.
  if Mix.env() in [:dev, :test, :e2e] do
    import Phoenix.LiveDashboard.Router

    scope "/" do
      pipe_through([:fetch_session, :protect_from_forgery])

      live_dashboard("/dashboard", metrics: RichardBurtonWeb.Telemetry)

      # What the local mailer kept instead of sending it.
      forward("/dev/mailbox", Plug.Swoosh.MailboxPreview)
    end

    scope "/api/dev", RichardBurtonWeb do
      pipe_through(:api)

      post("/session", DevSessionController, :create)
    end
  end

  # Destructive test plumbing, mounted ONLY in the e2e environment: resets the
  # worker's database between Playwright tests (truncates every table). Keeping
  # it out of :dev means a misconfigured harness can never wipe real data.
  if Mix.env() == :e2e do
    scope "/test", RichardBurtonWeb do
      pipe_through(:api)

      post("/reset", E2EResetController, :create)
    end
  end
end
