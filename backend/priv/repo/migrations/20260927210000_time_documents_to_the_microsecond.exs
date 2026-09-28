defmodule RichardBurton.Repo.Migrations.TimeDocumentsToTheMicrosecond do
  use Ecto.Migration

  @moduledoc """
  Hold when a document was started and last changed to the microsecond.

  The list is ordered by when each document last changed, and a page of it is
  read on from the last document of the page before. To the second, a document
  changed in the same second as another ties with it, and the tie is settled by
  which was started later rather than by which changed last.
  """

  def change do
    alter table(:documents) do
      modify(:inserted_at, :naive_datetime_usec, from: :naive_datetime)
      modify(:updated_at, :naive_datetime_usec, from: :naive_datetime)
    end
  end
end
