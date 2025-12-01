# Setting up a Local GitHub Actions Runner

This project uses a self-hosted GitHub runner to deploy changes directly to your local Home Assistant instance. Follow these steps to set up the runner.

## Prerequisites

The machine where you will run the runner (e.g., your Home Assistant server, a NAS, or a separate Raspberry Pi) must have the following software installed:

- **Git**: To checkout the repository.
- **Docker** (Optional but recommended): If you want to run the runner in a container.
- **Bash**, **sudo**, **rsync**, **curl**, **jq**: Required by the deployment workflow.
  - On Debian/Ubuntu: `sudo apt-get install git rsync curl jq`

## Step 1: Add the Runner to your Repository

1. Go to your GitHub repository's **Settings**.
2. Select **Actions** > **Runners** in the left sidebar.
3. Click **New self-hosted runner**.
4. Select the operating system (e.g., **Linux**) and architecture (e.g., **x64**, **ARM64**).
5. Follow the download and configuration commands provided by GitHub.

## Step 2: Configure the Runner as a Service

It is recommended to run the runner as a service so it starts automatically. After configuring the runner (the `./config.sh` step), run:

```bash
sudo ./svc.sh install
sudo ./svc.sh start
```

## Step 3: Verify Environment

Ensure the runner has access to the Home Assistant configuration directory. The workflow expects to write to `/ha_config/custom_components/family_bell`.

If you are running the runner on the same machine as Home Assistant (e.g., using Docker), you might need to map the configuration volume.

If you are running the runner directly on the host (not in Docker), ensure the user running the runner has permission to write to `/ha_config` or whatever path you have configured.

**Note:** The workflow assumes the destination path is `/ha_config/custom_components/family_bell`. If your path is different, update the `DESTINATION_PATH` environment variable in `.github/workflows/deploy-local.yml`.

## Step 4: Configure Secrets

The workflow requires the following secrets to be added to your GitHub repository:

1. Go to **Settings** > **Secrets and variables** > **Actions**.
2. Click **New repository secret**.
3. Add the following secrets:
   - `HA_URL`: The URL of your Home Assistant instance (e.g., `http://192.168.1.5:8123` or `http://localhost:8123`).
   - `HA_TOKEN`: A Long-Lived Access Token.
     - To generate one: Go to your Home Assistant Profile (click your name/initials in the sidebar) > Scroll to **Long-Lived Access Tokens** > **Create Token**.

## Troubleshooting

- **Permission Denied**: If the runner cannot write to the folder, check the folder permissions or use `chown` to make the runner user the owner.
- **Missing Dependencies**: If the workflow fails with "command not found", ensure you have installed `rsync`, `curl`, and `jq` on the runner machine.
