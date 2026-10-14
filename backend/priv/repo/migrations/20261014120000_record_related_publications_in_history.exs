defmodule RichardBurton.Repo.Migrations.RecordRelatedPublicationsInHistory do
  @moduledoc """
  Adds `related` to the publication history: the other publications that a
  duplicate decision is about, each with its snapshot when the decision was
  made. See `RichardBurton.Publication.History`.
  """

  use Ecto.Migration

  def change do
    alter table(:publication_history) do
      add(:related, :map)
    end
  end
end
