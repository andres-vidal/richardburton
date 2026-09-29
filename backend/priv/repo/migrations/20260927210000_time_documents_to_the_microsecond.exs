defmodule RichardBurton.Repo.Migrations.TimeDocumentsToTheMicrosecond do
  use Ecto.Migration

  @moduledoc """
  Stores `inserted_at` and `updated_at` on `documents` to the microsecond.

  The list is ordered by `updated_at`, and each page starts after the last
  document of the previous page. With whole seconds, two documents changed in
  the same second would tie. The tie would go to the document created later,
  even when the other one changed last.
  """

  def change do
    alter table(:documents) do
      modify(:inserted_at, :naive_datetime_usec, from: :naive_datetime)
      modify(:updated_at, :naive_datetime_usec, from: :naive_datetime)
    end
  end
end
