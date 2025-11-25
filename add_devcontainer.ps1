# 1. Create Directories
Write-Host "Creating DevContainer directories..."
New-Item -Path ".devcontainer" -ItemType Directory -Force | Out-Null
New-Item -Path ".vscode" -ItemType Directory -Force | Out-Null

# 2. Create requirements.txt
Write-Host "Creating requirements.txt..."
$requirements = @"
homeassistant
colorlog
pytest-homeassistant-custom-component
"@
$requirements | Out-File -FilePath "requirements.txt" -Encoding utf8

# 3. Create .devcontainer/devcontainer.json
Write-Host "Creating devcontainer.json..."
# Note: The postCreateCommand runs INSIDE Linux, so 'ln -sf' is correct even on Windows host
$devcontainer = @"
{
  "name": "Home Assistant Dev",
  "image": "mcr.microsoft.com/devcontainers/python:1-3.12-bullseye",
  "features": {
    "ghcr.io/devcontainers/features/git:1": {}
  },
  "customizations": {
    "vscode": {
      "extensions": [
        "ms-python.python",
        "keesschollaart.vscode-home-assistant",
        "esbenp.prettier-vscode",
        "charliermarsh.ruff"
      ]
    }
  },
  "postCreateCommand": "pip3 install --user -r requirements.txt && mkdir -p config/custom_components && ln -sf \${containerWorkspaceFolder}/custom_components/family_bell config/custom_components/family_bell",
  "remoteUser": "vscode"
}
"@
$devcontainer | Out-File -FilePath ".devcontainer\devcontainer.json" -Encoding utf8

# 4. Create .vscode/tasks.json
Write-Host "Creating VS Code Tasks..."
$tasks = @"
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "Run Home Assistant",
      "type": "shell",
      "command": "hass -c ./config",
      "group": {
        "kind": "build",
        "isDefault": true
      },
      "presentation": {
        "reveal": "always",
        "panel": "new"
      },
      "problemMatcher": []
    },
    {
      "label": "Run Tests",
      "type": "shell",
      "command": "pytest",
      "group": "test",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      }
    }
  ]
}
"@
$tasks | Out-File -FilePath ".vscode\tasks.json" -Encoding utf8

# 5. Create .vscode/launch.json
Write-Host "Creating Debug Launcher..."
$launch = @"
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Home Assistant",
      "type": "python",
      "request": "launch",
      "module": "homeassistant",
      "args": ["-c", "config"],
      "justMyCode": false
    }
  ]
}
"@
$launch | Out-File -FilePath ".vscode\launch.json" -Encoding utf8

Write-Host "DevContainer configuration added! 🚀"