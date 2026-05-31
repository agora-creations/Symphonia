defmodule SymphoniaService.Runners.SelectionPolicy do
  @moduledoc """
  Runner selection policy for Coding Assistant runs.
  """

  alias SymphoniaService.Access.{Actor, AuditLog, Policy}
  alias SymphoniaService.Harness.Daemon
  alias SymphoniaService.Runners.{Capabilities, LocalService, Registry, RepositoryPolicy}

  def select_for_run(registry_path, repository, actor, opts \\ []) do
    requested_runner_id = Keyword.get(opts, :runner_id)

    case requested_runner_id do
      nil -> select_local_service(registry_path, repository, actor)
      "" -> select_local_service(registry_path, repository, actor)
      "local-service" -> select_local_service(registry_path, repository, actor)
      runner_id -> select_remote_runner(registry_path, repository, actor, runner_id, opts)
    end
  end

  def select_local_service(registry_path, repository, actor \\ Actor.harness()) do
    runner = LocalService.runner_metadata()

    audit_selection(
      registry_path,
      repository,
      actor,
      "runner.selection_allowed",
      runner,
      "selected"
    )

    {:ok, runner}
  end

  defp select_remote_runner(registry_path, repository, actor, runner_id, opts) do
    with {:ok, private_runner} <- Registry.get(registry_path, runner_id),
         public_runner <- Registry.public(private_runner),
         :ok <- require_trusted(private_runner),
         :ok <- require_token_active(private_runner),
         :ok <- require_online(public_runner),
         :ok <- require_capabilities(public_runner, opts),
         :ok <- require_capacity(public_runner),
         :ok <- require_permission(actor, repository),
         :ok <- require_repository_policy(repository),
         :ok <- require_execution_flag(opts),
         :ok <- require_repository_runner(repository, runner_id),
         :ok <- require_harness_not_paused(registry_path, opts) do
      runner = metadata(public_runner)

      audit_selection(
        registry_path,
        repository,
        actor,
        "runner.selection_allowed",
        runner,
        "selected"
      )

      {:ok, runner}
    else
      {:error, reason} ->
        reason = to_string(reason)
        runner = rejected_runner(registry_path, runner_id)

        audit_selection(
          registry_path,
          repository,
          actor,
          "runner.selection_denied",
          runner,
          reason
        )

        {:error, rejection_payload(reason)}
    end
  end

  defp require_online(%{"status" => "online"}), do: :ok
  defp require_online(%{"status" => "disabled"}), do: {:error, "runner_disabled"}
  defp require_online(%{"status" => "stale"}), do: {:error, "runner_stale"}
  defp require_online(%{"status" => "offline"}), do: {:error, "runner_offline"}
  defp require_online(_runner), do: {:error, "runner_unavailable"}

  defp require_trusted(runner) do
    case Registry.trust_state(runner) do
      "trusted" -> :ok
      "pending" -> {:error, "runner_not_trusted"}
      "disabled" -> {:error, "runner_disabled"}
      "revoked" -> {:error, "runner_revoked"}
      _state -> {:error, "runner_not_trusted"}
    end
  end

  defp require_token_active(runner) do
    case Registry.token_state(runner) do
      "active" -> :ok
      "revoked" -> {:error, "runner_token_revoked"}
      "rotated" -> {:error, "runner_token_rotated"}
      _state -> {:error, "runner_token_invalid"}
    end
  end

  defp require_capabilities(%{"capabilities" => capabilities}, opts) do
    workspace_provider = Keyword.get(opts, :workspace_provider, "local_git_worktree")
    remote_execution? = Keyword.get(opts, :remote_execution, false) == true

    cond do
      capabilities["codexAppServer"] != true ->
        {:error, "missing_codex_capability"}

      remote_execution? ->
        :ok

      workspace_provider == "local_git_worktree" and capabilities["localGitWorktree"] != true ->
        {:error, "missing_workspace_capability"}

      workspace_provider == "experimental_sandbox" and capabilities["experimentalSandbox"] != true ->
        {:error, "missing_workspace_capability"}

      true ->
        :ok
    end
  end

  defp require_capacity(%{"currentRuns" => current, "limits" => %{"maxConcurrentRuns" => max}})
       when is_integer(current) and is_integer(max) and current < max,
       do: :ok

  defp require_capacity(_runner), do: {:error, "runner_capacity_full"}

  defp require_permission(actor, repository) do
    case Policy.authorize(actor, "runner.use_remote", repository) do
      :ok -> :ok
      {:error, _payload} -> {:error, "permission_denied"}
    end
  end

  defp require_repository_policy(repository) do
    if RepositoryPolicy.remote_execution_allowed?(repository) do
      :ok
    else
      {:error, "remote_execution_disabled"}
    end
  end

  defp require_repository_runner(repository, runner_id) do
    if RepositoryPolicy.runner_allowed?(repository, runner_id) do
      :ok
    else
      {:error, "runner_not_allowed_for_repository"}
    end
  end

  defp require_execution_flag(opts) do
    if Keyword.get(opts, :allow_remote_execution, false) == true do
      :ok
    else
      {:error, "remote_execution_disabled"}
    end
  end

  defp require_harness_not_paused(registry_path, opts) do
    if Keyword.get(opts, :remote_execution, false) == true and
         Daemon.peek_status(registry_path)["paused"] == true do
      {:error, "harness_paused"}
    else
      :ok
    end
  end

  defp metadata(public_runner) do
    %{
      "id" => public_runner["id"],
      "mode" => public_runner["mode"],
      "name" => public_runner["name"],
      "trustState" => public_runner["trustState"],
      "healthState" => public_runner["healthState"],
      "tokenState" => public_runner["tokenState"]
    }
  end

  defp rejected_runner(registry_path, runner_id) do
    case Registry.get(registry_path, runner_id) do
      {:ok, runner} -> metadata(Registry.public(runner))
      _ -> %{"id" => runner_id, "mode" => "remote_runner", "name" => "Remote runner"}
    end
  end

  defp rejection_payload("permission_denied") do
    {403,
     %{
       "error" => "You do not have permission to use remote runners for this repository.",
       "reasonCode" => "permission_denied",
       "permission" => "runner.use_remote"
     }}
  end

  defp rejection_payload(reason) when reason in ["runner_capacity_full"] do
    {409, %{"error" => "Requested runner has no available capacity.", "reasonCode" => reason}}
  end

  defp rejection_payload(reason) do
    {403, %{"error" => rejection_message(reason), "reasonCode" => reason}}
  end

  defp rejection_message("not_found"), do: "Requested runner was not found."
  defp rejection_message("runner_disabled"), do: "Requested runner is disabled."
  defp rejection_message("runner_stale"), do: "Requested runner heartbeat is stale."
  defp rejection_message("runner_offline"), do: "Requested runner is offline."
  defp rejection_message("runner_not_trusted"), do: "Requested runner is not trusted."
  defp rejection_message("runner_revoked"), do: "Requested runner is revoked."
  defp rejection_message("runner_token_rotated"), do: "Requested runner token has been rotated."
  defp rejection_message("runner_token_revoked"), do: "Requested runner token is revoked."
  defp rejection_message("runner_token_invalid"), do: "Requested runner token is invalid."
  defp rejection_message("runner_not_allowed_for_repository"),
    do: "Requested runner is not allowed for this repository."

  defp rejection_message("missing_codex_capability"), do: "Requested runner cannot run Codex."
  defp rejection_message("harness_paused"), do: "Remote runner execution is paused."

  defp rejection_message("missing_workspace_capability"),
    do: "Requested runner cannot use this workspace provider."

  defp rejection_message("remote_execution_disabled"),
    do: "Remote runner execution is disabled by default."

  defp rejection_message(_reason), do: "Requested runner cannot be selected for this run."

  defp audit_selection(registry_path, repository, actor, action, runner, reason_code) do
    AuditLog.record(registry_path, repository || %{"key" => "GLOBAL"}, %{
      "actor" => actor,
      "action" => action,
      "target" => %{"type" => "runner", "id" => runner["id"]},
      "result" => "completed",
      "metadata" => %{
        "runnerId" => runner["id"],
        "runnerMode" => runner["mode"],
        "trustState" => runner["trustState"],
        "healthState" => runner["healthState"],
        "tokenState" => runner["tokenState"],
        "capabilitySummary" => capability_summary(registry_path, runner["id"]),
        "reasonCode" => reason_code
      }
    })
  rescue
    _error -> :ok
  end

  defp capability_summary(_registry_path, "local-service"),
    do: "codex, local-worktree, validation"

  defp capability_summary(registry_path, runner_id) do
    case Registry.get(registry_path, runner_id) do
      {:ok, runner} -> Capabilities.summary(runner["capabilities"])
      _ -> "unknown"
    end
  end
end
