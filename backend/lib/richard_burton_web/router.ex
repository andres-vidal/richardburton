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

  pipeline :authorize_admin do
    plug(RichardBurtonWeb.Plugs.Authenticate.Cookie)
    plug(RichardBurtonWeb.Plugs.VerifyCsrf)
    plug(RichardBurtonWeb.Plugs.Authorize.Admin)
  end

  pipeline :authorize_recaptcha do
    plug(RichardBurtonWeb.Plugs.Authorize.Recaptcha)
  end

  scope "/api", RichardBurtonWeb do
    pipe_through(:api)
    get("/publications", PublicationController, :index)
    get("/users/me", UserController, :me)
    delete("/sessions", SessionController, :delete)
  end

  scope "/api", RichardBurtonWeb do
    pipe_through(:api)
    pipe_through(:authorize_recaptcha)
    post("/contact", EmailController, :contact)
  end

  scope "/api", RichardBurtonWeb do
    pipe_through(:api)
    pipe_through(:authorize_admin)

    get("/authors", AuthorController, :index)
    get("/publishers", PublisherController, :index)

    scope "/publications" do
      post("/bulk", PublicationController, :create_all)
      post("/validate", PublicationController, :validate)
      put("/:id", PublicationController, :update)
      post("/:id/validate", PublicationController, :validate)
    end
  end

  scope "/api", RichardBurtonWeb do
    pipe_through(:authenticate_bearer)
    post("/users", UserController, :create)
    post("/sessions", SessionController, :create)
  end

  scope "/api/files", RichardBurtonWeb do
    pipe_through(:files)
    pipe_through(:authorize_admin)

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
