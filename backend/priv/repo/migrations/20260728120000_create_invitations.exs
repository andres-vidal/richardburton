defmodule RichardBurton.Repo.Migrations.CreateInvitations do
  use Ecto.Migration

  # An invitation is a role held for an address until whoever owns it signs in.
  # It is keyed on the address alone because that is all an admin knows before
  # the first sign-in — the provider mints the subject id, and only then.
  def change do
    create table(:invitations) do
      add :email, :string, null: false
      add :role, :string, null: false
      add :invited_by_id, references(:users, on_delete: :nilify_all)
      add :accepted_at, :utc_datetime

      timestamps()
    end

    # One address can be waiting on one invitation. An accepted one is history
    # and does not stand in the way of inviting that person again, so the
    # constraint covers pending rows only. Case-insensitively: nobody means a
    # different person by a capital letter.
    create unique_index(:invitations, ["lower(email)"],
             where: "accepted_at IS NULL",
             name: :invitations_pending_email_index
           )

    create index(:invitations, [:invited_by_id])
  end
end
