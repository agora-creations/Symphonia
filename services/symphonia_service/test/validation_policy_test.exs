defmodule SymphoniaService.ValidationPolicyTest do
  use ExUnit.Case, async: true

  alias SymphoniaService.Validation.Policy

  setup do
    root =
      Path.join(
        System.tmp_dir!(),
        "symphonia-validation-policy-#{System.unique_integer([:positive])}"
      )

    File.mkdir_p!(root)

    on_exit(fn -> File.rm_rf(root) end)

    %{root: root}
  end

  test "reads explicit WORKFLOW.md validation commands and keeps proof expectations separate", %{
    root: root
  } do
    File.write!(Path.join(root, "WORKFLOW.md"), """
    # WORKFLOW.md

    validation:
      required:
        - label: Typecheck
          command: npm run typecheck
        - label: Tests
          command: npm test
      optional:
        - label: Lint
          command: npm run lint

    on_run_complete:
      - status: in_review
    """)

    policy =
      Policy.load(root, %{
        "reviewExpectations" => [
          "Human verifies the task; do not run this as a shell command."
        ]
      })

    assert policy["source"] == "workflow"

    assert policy["proof_expectations"] == [
             "Human verifies the task; do not run this as a shell command."
           ]

    assert Enum.map(policy["commands"], & &1["label"]) == ["Typecheck", "Tests", "Lint"]

    assert Enum.map(policy["commands"], & &1["command"]) == [
             "npm run typecheck",
             "npm test",
             "npm run lint"
           ]

    assert Enum.map(policy["commands"], & &1["required"]) == [true, true, false]

    refute Enum.any?(policy["commands"], fn command ->
             command["command"] =~ "Human verifies"
           end)
  end

  test "infers only existing package.json scripts", %{root: root} do
    File.write!(Path.join(root, "package.json"), """
    {
      "scripts": {
        "test": "node test.js",
        "lint": "eslint ."
      }
    }
    """)

    policy = Policy.load(root, %{})

    assert policy["source"] == "inferred"
    assert Enum.map(policy["commands"], & &1["id"]) == ["package_json_test", "package_json_lint"]
    assert Enum.map(policy["commands"], & &1["command"]) == ["npm test", "npm run lint"]
    assert Enum.map(policy["commands"], & &1["required"]) == [true, false]
  end

  test "infers conservative non-node repository defaults", %{root: root} do
    File.write!(Path.join(root, "mix.exs"), "defmodule Fixture.MixProject do\nend\n")
    File.write!(Path.join(root, "pyproject.toml"), "[tool.pytest.ini_options]\n")
    File.write!(Path.join(root, "Cargo.toml"), "[package]\nname = \"fixture\"\n")
    File.write!(Path.join(root, "go.mod"), "module example.invalid/fixture\n")

    policy = Policy.load(root, %{})

    assert Enum.map(policy["commands"], & &1["id"]) == [
             "mix_test",
             "pytest",
             "cargo_test",
             "go_test"
           ]

    assert Enum.map(policy["commands"], & &1["command"]) == [
             "mix test",
             "pytest",
             "cargo test",
             "go test ./..."
           ]
  end

  test "returns a safe no-validation policy when no source exists", %{root: root} do
    assert %{
             "source" => "not_configured",
             "commands" => [],
             "proof_expectations" => []
           } = Policy.load(root, %{})
  end
end
