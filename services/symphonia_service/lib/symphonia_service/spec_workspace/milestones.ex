defmodule SymphoniaService.SpecWorkspace.Milestones do
  @moduledoc """
  Milestone artifact helpers.
  """

  alias SymphoniaService.SpecWorkspace.Store

  def create(repository, attrs \\ %{}), do: Store.create_artifact(repository, "milestone", attrs)
end
