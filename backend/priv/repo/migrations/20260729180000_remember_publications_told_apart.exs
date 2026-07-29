defmodule RichardBurton.Repo.Migrations.RememberPublicationsToldApart do
  use Ecto.Migration

  @moduledoc """
  What an admin has already said is not a duplicate.

  Near-matches are found by similarity, which cannot tell two editions of one
  book from two records of one edition. Only a person can, and the answer has to
  outlive the sitting: without it the wizard asks the same question forever and
  its tail never clears.

  A decision is about a pair, and a pair is unordered — so it is stored with the
  lower id first, and the unique index is what keeps one decision one row.
  """

  def change do
    create table(:publication_distinctions) do
      add(:publication_id, references(:publications, on_delete: :delete_all), null: false)
      add(:other_publication_id, references(:publications, on_delete: :delete_all), null: false)
      add(:actor, :string, null: false)

      timestamps(updated_at: false)
    end

    create(
      unique_index(:publication_distinctions, [:publication_id, :other_publication_id],
        name: :publication_distinctions_pair
      )
    )

    create(
      constraint(:publication_distinctions, :publication_distinctions_ordered_pair,
        check: "publication_id < other_publication_id"
      )
    )
  end
end
