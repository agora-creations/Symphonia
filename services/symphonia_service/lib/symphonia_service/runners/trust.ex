defmodule SymphoniaService.Runners.Trust do
  @moduledoc """
  Runner trust-state helpers.
  """

  alias SymphoniaService.Runners.Registry

  @trusted "trusted"

  def trusted?(runner) when is_map(runner) do
    Registry.trust_state(runner) == @trusted and Registry.token_state(runner) == "active"
  end

  def trust_state(runner), do: Registry.trust_state(runner)
  def token_state(runner), do: Registry.token_state(runner)
  def health_state(runner), do: Registry.health_state(runner)
end
