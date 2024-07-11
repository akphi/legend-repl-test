import { exec, execSync } from 'child_process';
import { existsSync } from 'fs';
import {
  window,
  ThemeIcon,
  type ExtensionContext,
  type CancellationToken,
  type TerminalProfile,
  type ProviderResult,
  workspace,
  ProgressLocation,
  commands,
} from 'vscode';

const REPL_TERMINAL_NAME = 'Legend REPL (test)';

async function downloadReplJar(
  context: ExtensionContext,
  version: string,
  replDir: string,
  replJARPath: string,
) {
  execSync(
    `rm -rf ${context.asAbsolutePath(
      replDir,
    )} && mkdir ${context.asAbsolutePath(replDir)}`,
  );
  const replJarDownloadUrl = (
    workspace.getConfiguration('repl').get('jarDownloadUrl') as string
  ).replace('{{version}}', version);
  await window.withProgress(
    {
      location: ProgressLocation.Notification,
      title: `Downloading REPL JAR from: ${replJarDownloadUrl}`,
    },
    (progress) => {
      return new Promise((resolve, reject) => {
        exec(
          `curl -L ${replJarDownloadUrl} -o ${context.asAbsolutePath(
            replJARPath,
          )}`,
          (error) => {
            if (!error) {
              resolve('');
            } else {
              reject(error);
            }
          },
        );
      });
    },
  );
}

export async function activate(context: ExtensionContext) {
  const version = context.extension.packageJSON.version;
  const replDir = `repl`;
  const replJARPath = `${replDir}/legend-repl-${version}.jar`;
  if (!existsSync(context.asAbsolutePath(replJARPath))) {
    await downloadReplJar(context, version, replDir, replJARPath);
  }

  let port = 9006;
  await import('get-port').then(async (module) => {
    port = await module.default();
  });

  const terminalProfileProvider = window.registerTerminalProfileProvider(
    'legend-repl-test.terminal.repl',
    {
      provideTerminalProfile(): ProviderResult<TerminalProfile> {
        return {
          options: {
            name: REPL_TERMINAL_NAME,
            shellPath: 'java',
            shellArgs: [
              process.env.VSCODE_PROXY_URI !== undefined &&
                `-Dlegend.repl.dataCube.devWebAppBaseUrl=${process.env.VSCODE_PROXY_URI!.replace(
                  '{{port}}',
                  port.toString(),
                )}`,
              `-Dlegend.repl.dataCube.devPort=${port}`,
              Boolean(
                workspace.getConfiguration('repl').get('agGridLicense'),
              ) &&
                `-Dlegend.repl.dataCube.gridLicenseKey=${
                  workspace
                    .getConfiguration('repl')
                    .get('agGridLicense') as string
                }`,
              '-jar',
              context.asAbsolutePath(replJARPath),
            ].filter((val): val is string => Boolean(val)),
            message:
              `Starting ${REPL_TERMINAL_NAME}...\r\n\r\nType 'help' or hit 'Enter' to see the full list of commands and their usage.\r\n` +
              `Check out Data Cube by using the included example data:\r\n\x1b[1;32m\r\n` +
              `> load ${context.asAbsolutePath(
                'data/sport.csv',
              )} local::DuckDuckConnection sport\r\n` +
              `> #>{local::DuckDuckDatabase.sport}#->sort([])->from(local::DuckDuckRuntime)\r\n` +
              `> show\r\n\x1b[0m\r\n`,
            iconPath: new ThemeIcon('repl'),
          },
        };
      },
    },
  );

  context.subscriptions.push(terminalProfileProvider);

  const reDownloadJarCommand = commands.registerCommand(
    'legend-repl-test.command.refreshJar',
    async () => {
      await downloadReplJar(context, version, replDir, replJARPath);
    },
  );
  context.subscriptions.push(reDownloadJarCommand);
}

export function deactivate(): void {
  // do nothing
}
