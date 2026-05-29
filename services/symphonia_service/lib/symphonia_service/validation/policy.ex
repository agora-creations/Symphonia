defmodule SymphoniaService.Validation.Policy do
  @moduledoc """
  Finds local machine-validation commands for a task workspace.

  Review expectations stay human proof criteria. They are carried for UI context
  but are never converted into shell commands.
  """

  @script_order [
    {"typecheck", "Typecheck", "npm run typecheck", true},
    {"test", "Tests", "npm test", true},
    {"lint", "Lint", "npm run lint", false},
    {"build", "Build", "npm run build", true}
  ]

  def load(repo_path, task \\ %{}) when is_binary(repo_path) do
    workflow_commands = workflow_commands(repo_path)
    inferred_commands = if workflow_commands == [], do: infer_commands(repo_path), else: []

    commands =
      case workflow_commands do
        [] -> inferred_commands
        values -> values
      end

    %{
      "source" => source_for(workflow_commands, inferred_commands),
      "commands" => commands,
      "proof_expectations" => proof_expectations(task)
    }
  end

  defp source_for([_first | _rest], _inferred), do: "workflow"
  defp source_for([], [_first | _rest]), do: "inferred"
  defp source_for([], []), do: "not_configured"

  defp workflow_commands(repo_path) do
    path = Path.join(repo_path, "WORKFLOW.md")

    case File.read(path) do
      {:ok, body} -> parse_validation_block(body)
      {:error, _reason} -> []
    end
  end

  def parse_validation_block(body) when is_binary(body) do
    body
    |> String.split("\n")
    |> parse_lines(%{
      inside?: false,
      base_indent: nil,
      required?: true,
      current: nil,
      items: []
    })
    |> finalize_current()
    |> Map.fetch!(:items)
    |> Enum.reverse()
    |> Enum.with_index(1)
    |> Enum.map(fn {item, index} ->
      item
      |> Map.put_new("label", label_from_command(item["command"]))
      |> Map.put_new("required", true)
      |> Map.put_new("source", "workflow")
      |> Map.put(
        "id",
        item["id"] || "workflow_#{index}_#{slug(item["label"] || item["command"])}"
      )
    end)
    |> Enum.filter(&(present?(&1["command"]) and present?(&1["label"])))
  end

  defp parse_lines([], state), do: state

  defp parse_lines([line | rest], %{inside?: false} = state) do
    trimmed = String.trim(line)

    if Regex.match?(~r/^validation:\s*$/, trimmed) do
      parse_lines(rest, %{state | inside?: true, base_indent: indent(line), required?: true})
    else
      parse_lines(rest, state)
    end
  end

  defp parse_lines([line | rest], %{inside?: true, base_indent: base_indent} = state) do
    trimmed = String.trim(line)
    line_indent = indent(line)

    cond do
      trimmed == "" or String.starts_with?(trimmed, "#") or String.starts_with?(trimmed, "```") ->
        parse_lines(rest, state)

      line_indent <= base_indent and not validation_child?(trimmed) ->
        parse_lines(rest, %{finalize_current(state) | inside?: false, base_indent: nil})

      Regex.match?(~r/^required:\s*$/, trimmed) ->
        parse_lines(rest, %{state | required?: true})

      Regex.match?(~r/^optional:\s*$/, trimmed) ->
        parse_lines(rest, %{state | required?: false})

      Regex.match?(~r/^-\s*label:\s*(.+)$/, trimmed) ->
        [_, label] = Regex.run(~r/^-\s*label:\s*(.+)$/, trimmed)

        next_state =
          state
          |> finalize_current()
          |> Map.put(:current, %{
            "label" => clean_scalar(label),
            "required" => Map.fetch!(state, :required?),
            "source" => "workflow"
          })

        parse_lines(rest, next_state)

      Regex.match?(~r/^-\s*command:\s*(.+)$/, trimmed) ->
        [_, command] = Regex.run(~r/^-\s*command:\s*(.+)$/, trimmed)

        next_state =
          state
          |> finalize_current()
          |> Map.put(:current, %{
            "command" => clean_scalar(command),
            "required" => Map.fetch!(state, :required?),
            "source" => "workflow"
          })

        parse_lines(rest, next_state)

      Regex.match?(~r/^command:\s*(.+)$/, trimmed) ->
        [_, command] = Regex.run(~r/^command:\s*(.+)$/, trimmed)
        current = Map.put(Map.get(state, :current) || %{}, "command", clean_scalar(command))
        parse_lines(rest, %{state | current: current})

      true ->
        parse_lines(rest, state)
    end
  end

  defp validation_child?(trimmed) do
    Regex.match?(~r/^(required|optional):\s*$/, trimmed) or
      Regex.match?(~r/^-\s*(label|command):\s*/, trimmed) or
      Regex.match?(~r/^command:\s*/, trimmed)
  end

  defp finalize_current(%{current: nil} = state), do: state

  defp finalize_current(%{current: current, items: items} = state) do
    if present?(current["command"]) do
      %{state | current: nil, items: [current | items]}
    else
      %{state | current: nil}
    end
  end

  defp infer_commands(repo_path) do
    []
    |> Kernel.++(package_json_commands(repo_path))
    |> maybe_add_file_command(repo_path, "mix.exs", "mix_test", "Elixir tests", "mix test", true)
    |> maybe_add_python_command(repo_path)
    |> maybe_add_file_command(
      repo_path,
      "Cargo.toml",
      "cargo_test",
      "Cargo tests",
      "cargo test",
      true
    )
    |> maybe_add_file_command(repo_path, "go.mod", "go_test", "Go tests", "go test ./...", true)
  end

  defp package_json_commands(repo_path) do
    path = Path.join(repo_path, "package.json")

    with {:ok, body} <- File.read(path),
         {:ok, package} <- JSON.decode(body),
         scripts when is_map(scripts) <- package["scripts"] do
      @script_order
      |> Enum.filter(fn {script, _label, _command, _required?} ->
        present?(scripts[script])
      end)
      |> Enum.map(fn {script, label, command, required?} ->
        item("package_json_#{script}", label, command, required?, "package_json")
      end)
    else
      _ -> []
    end
  end

  defp maybe_add_file_command(commands, repo_path, file, id, label, command, required?) do
    if File.exists?(Path.join(repo_path, file)) do
      commands ++ [item(id, label, command, required?, file)]
    else
      commands
    end
  end

  defp maybe_add_python_command(commands, repo_path) do
    pyproject_path = Path.join(repo_path, "pyproject.toml")
    tests_path = Path.join(repo_path, "tests")

    configured? =
      case File.read(pyproject_path) do
        {:ok, body} -> String.contains?(body, "pytest") or File.dir?(tests_path)
        {:error, _reason} -> false
      end

    if configured? do
      commands ++ [item("pytest", "Python tests", "pytest", true, "pyproject_toml")]
    else
      commands
    end
  end

  defp item(id, label, command, required?, source) do
    %{
      "id" => id,
      "label" => label,
      "command" => command,
      "required" => required?,
      "source" => source
    }
  end

  defp proof_expectations(task) when is_map(task) do
    (task["reviewExpectations"] || get_in(task, [:frontmatter, "review_expectations"]))
    |> List.wrap()
    |> Enum.map(&to_string/1)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
  end

  defp indent(line), do: String.length(line) - String.length(String.trim_leading(line))

  defp clean_scalar(value) do
    value
    |> to_string()
    |> String.trim()
    |> String.trim("\"")
    |> String.trim("'")
  end

  defp label_from_command(command) do
    command
    |> to_string()
    |> String.trim()
    |> case do
      "" -> "Validation"
      value -> value
    end
  end

  defp slug(value) do
    value
    |> to_string()
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9]+/, "_")
    |> String.trim("_")
    |> case do
      "" -> "validation"
      slug -> slug
    end
  end

  defp present?(value), do: is_binary(value) and String.trim(value) != ""
end
