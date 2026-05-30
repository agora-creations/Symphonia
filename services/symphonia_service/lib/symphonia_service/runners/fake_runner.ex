defmodule SymphoniaService.Runners.FakeRunner do
  @moduledoc """
  Test-only fake runner contract fixture.
  """

  def capabilities do
    %{
      "codexAppServer" => true,
      "localGitWorktree" => false,
      "experimentalSandbox" => true,
      "validation" => true
    }
  end

  def registration_attrs(attrs \\ %{}) do
    Map.merge(
      %{
        "name" => "fake-runner",
        "registrationToken" => "fake-runner-token",
        "capabilities" => capabilities(),
        "limits" => %{"maxConcurrentRuns" => 1}
      },
      attrs
    )
  end

  def patch_bundle_fixture(
        runner_id \\ "fake-runner",
        run_id \\ "run_123",
        assignment_id \\ "assignment_123"
      ) do
    diff =
      """
      diff --git a/app/example.tsx b/app/example.tsx
      new file mode 100644
      index 0000000..1269488
      --- /dev/null
      +++ b/app/example.tsx
      @@ -0,0 +1 @@
      +export const example = true;
      """
      |> String.trim_leading()

    %{
      "assignmentId" => assignment_id,
      "runnerId" => runner_id,
      "runId" => run_id,
      "status" => "completed",
      "baseSha" => "base-sha",
      "headSha" => "head-sha",
      "patchBundle" => %{
        "format" => "git_diff",
        "encoding" => "utf8",
        "sha256" => SymphoniaService.Runners.PatchBundle.sha256(diff),
        "diff" => diff
      },
      "changedFiles" => [%{"path" => "app/example.tsx", "status" => "added"}],
      "changedFilesDigest" =>
        SymphoniaService.Runners.PatchBundle.changed_files_digest(["app/example.tsx"]),
      "runnerValidation" => [
        %{"label" => "Tests", "status" => "passed", "detail" => "Fake validation passed."}
      ],
      "publicTimeline" => [
        %{
          "step" => "running_provider",
          "message" => "Runner completed the Coding Assistant turn."
        }
      ],
      "publicSummary" => "Fake runner produced a fixture patch."
    }
  end
end
