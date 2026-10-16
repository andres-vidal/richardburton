defmodule RichardBurton.Repo.Migrations.AddNotesToPublications do
  @moduledoc """
  Adds `notes` to publications: rich text about the publication, stored as
  the JSON list of blocks that `RichardBurton.RichText` describes, or NULL
  when it has none. The column has no default, so a row inserted without
  notes holds NULL.

  The `flat_publications` view does not carry the notes, so the search does
  not read them.
  """

  use Ecto.Migration

  def change do
    alter table(:publications) do
      add(:notes, :jsonb)
    end
  end
end
