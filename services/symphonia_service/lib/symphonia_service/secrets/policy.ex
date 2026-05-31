defmodule SymphoniaService.Secrets.Policy do
  @moduledoc """
  Repository policy checks for secret reference scopes.
  """

  def allowed_scopes(repository) when is_map(repository) do
    scopes = repository["secretScopesAllowed"] || repository["secret_scopes_allowed"] || []

    scopes
    |> List.wrap()
    |> Enum.filter(&is_binary/1)
  end

  def allowed_scopes(_repository), do: []

  def scope_allowed?(repository, scope) when is_binary(scope) do
    scope in allowed_scopes(repository)
  end

  def scope_allowed?(_repository, _scope), do: false
end
