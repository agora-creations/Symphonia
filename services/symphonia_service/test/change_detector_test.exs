defmodule SymphoniaService.ChangeDetectorTest do
  use ExUnit.Case

  alias SymphoniaService.CodingAssistant.ChangeDetector

  setup do
    root =
      Path.join(
        System.tmp_dir!(),
        "symphonia-change-detector-#{System.unique_integer([:positive])}"
      )

    File.mkdir_p!(root)
    git_output!(["-C", root, "init"])
    File.write!(Path.join(root, "README.md"), "# Test\n")
    git_output!(["-C", root, "add", "README.md"])

    git_output!([
      "-C",
      root,
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-m",
      "Initial commit"
    ])

    on_exit(fn -> File.rm_rf(root) end)

    %{root: root}
  end

  test "detects work product and excludes Symphonia metadata", %{root: root} do
    write!(root, "app/page.tsx", "export default function Page() { return null }\n")
    write!(root, "symphonia/tasks/SYM-1.md", "metadata\n")
    write!(root, "symphonia/run-summaries/run.md", "summary\n")
    write!(root, "WORKFLOW.md", "workflow\n")
    write!(root, ".symphonia/local.json", "{}\n")

    changes = ChangeDetector.detect!(root)

    assert changes["committable"] == ["app/page.tsx"]

    assert changes["excluded"] == [
             ".symphonia/local.json",
             "WORKFLOW.md",
             "symphonia/run-summaries/run.md",
             "symphonia/tasks/SYM-1.md"
           ]
  end

  test "reports no committable files when only metadata changed", %{root: root} do
    write!(root, "symphonia/tasks/SYM-1.md", "metadata\n")

    assert ChangeDetector.detect!(root) == %{
             "committable" => [],
             "excluded" => ["symphonia/tasks/SYM-1.md"]
           }
  end

  defp write!(root, relative_path, body) do
    path = Path.join(root, relative_path)
    path |> Path.dirname() |> File.mkdir_p!()
    File.write!(path, body)
  end

  defp git_output!(args) do
    case System.cmd("git", args, stderr_to_stdout: true) do
      {output, 0} -> output
      {output, _status} -> flunk("git #{Enum.join(args, " ")} failed:\n#{output}")
    end
  end
end
