defmodule SymphoniaService.Runners.RepositoryPolicy do
  @moduledoc """
  Repository-level remote execution policy.

  Remote execution is default-off and stored in the private repository registry,
  not in repository Markdown.
  """

  alias SymphoniaService.RepositoryRegistry

  def remote_execution_allowed?(repository) when is_map(repository) do
    repository["remoteExecutionAllowed"] == true or repository["remote_execution_allowed"] == true or
      get_in(repository, ["automation", "remoteExecutionAllowed"]) == true or
      get_in(repository, ["automation", "remote_execution_allowed"]) == true
  end

  def remote_execution_allowed?(_repository), do: false

  def public(repository) when is_map(repository) do
    %{
      "remoteExecutionAllowed" => remote_execution_allowed?(repository)
    }
  end

  def set_remote_execution(registry_path, repo_key, allowed?) when is_boolean(allowed?) do
    RepositoryRegistry.update(registry_path, repo_key, fn repository ->
      Map.put(repository, "remoteExecutionAllowed", allowed?)
    end)
  end
end
