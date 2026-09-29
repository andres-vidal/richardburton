defmodule RichardBurton.Repo.Migrations.RetireDocuments do
  use Ecto.Migration

  @moduledoc """
  Adds `archived_at` to `documents`, so that a document can be archived.

  An archived document is left out of the list but keeps its content, because
  the content is a record of what was prepared. Archiving keeps the list short
  without deleting anything.
  """

  def change do
    alter table(:documents) do
      add(:archived_at, :utc_datetime)
    end

    # Covers the list query, which filters on `archived_at` and orders by
    # `updated_at`, most recent first.
    create(index(:documents, [:archived_at, :updated_at]))
  end
end
