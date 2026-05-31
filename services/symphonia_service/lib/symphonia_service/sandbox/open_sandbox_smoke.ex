defmodule SymphoniaService.Sandbox.OpenSandboxSmoke do
  @moduledoc """
  Explicit OpenSandbox runtime smoke action.

  This exercises a real sandbox lifecycle with a tiny fixture repository. It is
  not a task run and does not write handoffs, review branches, task Markdown, or
  PR state.
  """

  alias SymphoniaService.Access.AuditLog
  alias SymphoniaService.Runners.PatchBundle
  alias SymphoniaService.Sandbox.{
    OpenSandboxError,
    OpenSandboxOperations,
    OpenSandboxProvider,
    Session
  }

  @runner_id "sandbox_opensandbox_smoke"

  def run(registry_path, repository, actor, opts \\ %{}) do
    audit(registry_path, repository, actor, "sandbox.opensandbox_smoke_started", "completed")
    OpenSandboxOperations.record_smoke_started(registry_path, repository)

    root =
      Path.join(System.tmp_dir!(), "symphonia-opensandbox-smoke-#{System.unique_integer([:positive])}")

    try do
      case fixture_repository(root) do
        {:ok, fixture} ->
          run_fixture(registry_path, repository, actor, fixture, opts)

        {:error, reason} ->
          failure(registry_path, repository, actor, reason, false)
      end
    after
      File.rm_rf(root)
    end
  end

  defp run_fixture(registry_path, repository, actor, fixture, opts) do
    assignment = assignment(repository, fixture)

    create_opts =
      opts
      |> Map.merge(%{
        "assignment" => assignment,
        "registry_path" => registry_path,
        "repository" => repository,
        "runnerCommand" => fixture_command()
      })

    case OpenSandboxProvider.create(create_opts) do
      {:ok, session} ->
        prepare_fixture(registry_path, repository, actor, fixture, assignment, session)

      {:error, reason} ->
        failure(registry_path, repository, actor, reason, false)
    end
  end

  defp prepare_fixture(registry_path, repository, actor, fixture, assignment, session) do
    case OpenSandboxProvider.prepare(session, fixture, assignment) do
      {:ok, context} ->
        run_prepared(registry_path, repository, actor, assignment, context)

      {:error, reason} ->
        release_result = OpenSandboxProvider.release(session)
        cleanup_result = cleanup_warning?(release_result)
        failure(registry_path, repository, actor, reason, cleanup_result)
    end
  end

  defp run_prepared(registry_path, repository, actor, assignment, context) do
    case OpenSandboxProvider.run(Session.mark(context, "running"), context, assignment) do
      {:ok, result} ->
        validation = PatchBundle.validate(result, assignment)
        release_result = OpenSandboxProvider.release(context)
        cleanup_warning? = cleanup_warning?(release_result)

        case validation do
          {:ok, bundle} ->
            success(registry_path, repository, actor, bundle, cleanup_warning?)

          {:error, reason} ->
            failure(registry_path, repository, actor, reason, cleanup_warning?)
        end

      {:error, reason} ->
        release_result = OpenSandboxProvider.release(context)
        cleanup_warning? = cleanup_warning?(release_result)
        failure(registry_path, repository, actor, reason, cleanup_warning?)
    end
  end

  defp success(registry_path, repository, actor, bundle, cleanup_warning?) do
    if cleanup_warning? do
      OpenSandboxOperations.record_cleanup(registry_path, repository, {:error, "sandbox_release_failed"})
    else
      OpenSandboxOperations.record_cleanup(registry_path, repository, :ok)
    end

    operations =
      OpenSandboxOperations.record_smoke_passed(registry_path, repository, cleanup_warning?)

    audit(
      registry_path,
      repository,
      actor,
      "sandbox.opensandbox_smoke_completed",
      "completed",
      changedFileCount: bundle["changed_file_count"]
    )

    {:ok,
     %{
       "provider" => "opensandbox",
       "status" => "passed",
       "message" => "OpenSandbox fixture smoke passed.",
       "workspaceMode" => "source_bundle",
       "changedFileCount" => bundle["changed_file_count"],
       "cleanupWarning" => cleanup_warning?,
       "operations" => operations
     }}
  end

  defp failure(registry_path, repository, actor, reason, cleanup_warning?) do
    reason_code = OpenSandboxError.normalize(reason)

    if cleanup_warning? do
      OpenSandboxOperations.record_cleanup(registry_path, repository, {:error, "sandbox_release_failed"})
    end

    operations =
      OpenSandboxOperations.record_smoke_failed(registry_path, repository, reason_code, cleanup_warning?)

    audit(
      registry_path,
      repository,
      actor,
      "sandbox.opensandbox_smoke_failed",
      "failed",
      reasonCode: reason_code
    )

    {:error,
     {409,
      %{
        "provider" => "opensandbox",
        "status" => "failed",
        "message" => OpenSandboxError.public_message(reason_code),
        "reasonCode" => reason_code,
        "workspaceMode" => "source_bundle",
        "cleanupWarning" => cleanup_warning?,
        "operations" => operations
      }}}
  end

  defp cleanup_warning?(:ok), do: false
  defp cleanup_warning?({:error, _reason}), do: true

  defp assignment(repository, fixture) do
    %{
      "id" => "assignment_opensandbox_smoke",
      "run_id" => "run_opensandbox_smoke",
      "repo_key" => repository["key"] || "SYM",
      "task_key" => "opensandbox-smoke",
      "runner_id" => @runner_id,
      "provider" => "codex_app_server",
      "base_branch" => "main",
      "base_sha" => fixture["base_sha"],
      "context_pack" => %{
        "publicTaskBrief" => "OpenSandbox fixture smoke.",
        "renderedPrompt" => "Create a deterministic smoke file.",
        "constraints" => [
          "Do not commit.",
          "Do not push.",
          "Do not edit Symphonia metadata."
        ]
      }
    }
  end

  defp fixture_repository(root) do
    repo_path = Path.join(root, "repo")
    File.mkdir_p!(Path.join(repo_path, "lib"))
    File.write!(Path.join(repo_path, "README.md"), "# OpenSandbox smoke\n")
    File.write!(Path.join(repo_path, "lib/fixture.ex"), "defmodule Fixture do\nend\n")

    with :ok <- git(repo_path, ["init", "-q"]),
         :ok <- git(repo_path, ["config", "user.name", "Symphonia"]),
         :ok <- git(repo_path, ["config", "user.email", "symphonia@sandbox.local"]),
         :ok <- git(repo_path, ["add", "."]),
         :ok <- git(repo_path, ["commit", "-m", "baseline", "-q"]),
         {:ok, sha} <- git_output(repo_path, ["rev-parse", "HEAD"]) do
      {:ok, %{"path" => repo_path, "base_sha" => String.trim(sha)}}
    else
      _other -> {:error, "sandbox_prepare_failed"}
    end
  rescue
    _error -> {:error, "sandbox_prepare_failed"}
  end

  defp fixture_command do
    """
    mkdir -p lib /workspace/.symphonia && python3 - <<'PY'
    import json
    import pathlib
    import subprocess

    path = pathlib.Path("lib/opensandbox_smoke.ex")
    path.write_text("defmodule OpenSandboxSmoke do\\n  def marker, do: :ok\\nend\\n")
    diff = subprocess.check_output(["git", "diff", "--", "lib/opensandbox_smoke.ex"], text=True)
    result = {
      "status": "completed",
      "patchBundle": {
        "format": "git_diff",
        "encoding": "utf8",
        "diff": diff
      },
      "changedFiles": [
        {"path": "lib/opensandbox_smoke.ex", "status": "added"}
      ],
      "publicSummary": "OpenSandbox fixture smoke produced a reviewable patch."
    }
    pathlib.Path("/workspace/.symphonia/result.json").write_text(json.dumps(result))
    PY
    """
    |> String.trim()
  end

  defp git(repo_path, args) do
    case System.cmd("git", ["-C", repo_path | args], stderr_to_stdout: true) do
      {_, 0} -> :ok
      _other -> {:error, "sandbox_prepare_failed"}
    end
  end

  defp git_output(repo_path, args) do
    case System.cmd("git", ["-C", repo_path | args], stderr_to_stdout: true) do
      {output, 0} -> {:ok, output}
      _other -> {:error, "sandbox_prepare_failed"}
    end
  end

  defp audit(registry_path, repository, actor, action, result, extra \\ []) do
    metadata =
      %{
        "provider" => "opensandbox",
        "workspaceProvider" => "cloud_sandbox",
        "reasonCode" => extra[:reasonCode],
        "changedFileCount" => extra[:changedFileCount]
      }
      |> Enum.reject(fn {_key, value} -> is_nil(value) end)
      |> Map.new()

    AuditLog.record(registry_path, repository, %{
      "actor" => actor,
      "action" => action,
      "target" => %{"type" => "repository", "id" => repository["key"]},
      "result" => result,
      "metadata" => metadata
    })

    :ok
  rescue
    _error -> :ok
  end
end
