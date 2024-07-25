ExUnit.start()
Faker.start()

Ecto.Adapters.SQL.Sandbox.mode(RichardBurton.Repo, :manual)

Mox.defmock(RichardBurton.AuthMock, for: RichardBurton.Auth)
Mox.defmock(RichardBurton.Auth.RecaptchaMock, for: RichardBurton.Auth.Recaptcha)
Mox.defmock(RichardBurton.MailerMock, for: RichardBurton.Mailer)

Application.put_env(:richard_burton, :auth_service, RichardBurton.AuthMock)
Application.put_env(:richard_burton, :auth_recaptcha_service, RichardBurton.Auth.RecaptchaMock)
Application.put_env(:richard_burton, :mailer, RichardBurton.MailerMock)
