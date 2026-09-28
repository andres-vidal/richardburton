defmodule RichardBurton.Repo.Migrations.RetireDocuments do
  use Ecto.Migration

  @moduledoc """
  How a document stops being offered without being destroyed.

  `archived_at` takes a document off the list. The work it holds is a record of
  what was prepared, and a list nobody can shorten is a list nobody reads.
  """

  def change do
    alter table(:documents) do
      add(:archived_at, :utc_datetime)
    end

    # The list shows what has not been retired, most recently changed first.
    create(index(:documents, [:archived_at, :updated_at]))
  end
end
