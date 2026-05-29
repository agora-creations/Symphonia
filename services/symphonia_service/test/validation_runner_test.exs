defmodule SymphoniaService.ValidationRunnerTest do
  use ExUnit.Case, async: true

  alias SymphoniaService.Validation.{Evidence, Runner}

  setup do
    root =
      Path.join(
        System.tmp_dir!(),
        "symphonia-validation-runner-#{System.unique_integer([:positive])}"
      )

    File.mkdir_p!(root)

    on_exit(fn -> File.rm_rf(root) end)

    %{root: root}
  end

  test "records passed, failed, and not configured validation", %{root: root} do
    policy = %{
      "commands" => [
        command("passing", "Passing", "printf pass"),
        command("failing", "Failing", "printf fail && exit 7")
      ]
    }

    assert {:ok, [passed, failed]} = Runner.run(root, policy)
    assert passed["status"] == "passed"
    assert passed["exit_status"] == 0
    assert passed["output"] == "pass"
    assert failed["status"] == "failed"
    assert failed["exit_status"] == 7
    assert failed["output"] == "fail"

    assert Evidence.public([passed, failed]) == [
             %{"label" => "Passing", "status" => "passed", "detail" => "Passing passed."},
             %{
               "label" => "Failing",
               "status" => "failed",
               "detail" => "Failing failed. Review the private run output locally."
             }
           ]

    assert {:ok, [not_configured]} = Runner.run(root, %{"commands" => []})

    assert Evidence.public([not_configured]) == [
             %{
               "label" => "Machine validation",
               "status" => "not_run",
               "detail" => "No machine validation command was configured."
             }
           ]
  end

  test "timeouts map to failed public evidence and capped private output", %{root: root} do
    policy = %{
      "commands" => [
        command("timeout", "Timeout", "sleep 1")
      ]
    }

    assert {:ok, [timed_out]} = Runner.run(root, policy, timeout_ms: 10, max_output_bytes: 4)
    assert timed_out["status"] == "timed_out"
    assert timed_out["duration_ms"] >= 0

    assert Evidence.public([timed_out]) == [
             %{
               "label" => "Timeout",
               "status" => "failed",
               "detail" =>
                 "Timeout timed out after 1 seconds. Review the private run output locally."
             }
           ]

    policy = %{"commands" => [command("large", "Large", "printf 123456789")]}
    assert {:ok, [large]} = Runner.run(root, policy, max_output_bytes: 4)
    assert large["output"] == "1234"
    assert large["output_truncated"] == true
  end

  test "public evidence redacts env-looking values and local paths", %{root: root} do
    label = "Secret API_TOKEN=abc at /Users/example/private/repo"
    policy = %{"commands" => [command("secret", label, "printf ok")]}

    assert {:ok, [result]} = Runner.run(root, policy)
    [public] = Evidence.public([result])

    refute public["label"] =~ "API_TOKEN=abc"
    refute public["label"] =~ "/Users/example"
    refute public["detail"] =~ "API_TOKEN=abc"
    refute public["detail"] =~ "/Users/example"
  end

  defp command(id, label, command) do
    %{
      "id" => id,
      "label" => label,
      "command" => command,
      "required" => true,
      "source" => "test"
    }
  end
end
