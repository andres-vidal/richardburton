defmodule RichardBurton.Repo.Migrations.CreateAuthSessions do
  use Ecto.Migration

  def change do
    create table(:auth_sessions) do
      add :subject_id, :string, null: false
      add :token_hash, :string, null: false
      add :expires_at, :utc_datetime, null: false

      timestamps(type: :utc_datetime)
    end

    create unique_index(:auth_sessions, [:token_hash])
    create index(:auth_sessions, [:subject_id])
  end
end
