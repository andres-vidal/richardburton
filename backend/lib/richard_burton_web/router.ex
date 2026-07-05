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
    plug(RichardBurtonWeb.Plugs.AuthorizeAdmin)
  end

  pipeline :authorize_recaptcha do
    plug(RichardBurtonWeb.Plugs.AuthorizeRecaptcha)
  end

  scope "/api", RichardBurtonWeb do
    pipe_through(:api)
    get("/publications", PublicationController, :index)
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

  # Enables LiveDashboard only for development
  #
  # If you want to use the LiveDashboard in production, you should put
  # it behind authentication and allow only admins to access it.
  # If your application does not have an admins-only section yet,
  # you can use Plug.BasicAuth to set up some basic authentication
  # as long as you are also using SSL (which you should anyway).
  if Mix.env() in [:dev, :test] do
    import Phoenix.LiveDashboard.Router

    scope "/" do
      pipe_through([:fetch_session, :protect_from_forgery])

      live_dashboard("/dashboard", metrics: RichardBurtonWeb.Telemetry)
    end
  end
end
