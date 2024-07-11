import { execSync } from 'child_process';
import { existsSync } from 'fs';
import {
  window,
  ThemeIcon,
  type ExtensionContext,
  type CancellationToken,
  type TerminalProfile,
  type ProviderResult,
  workspace,
} from 'vscode';

const REPL_TERMINAL_NAME = 'Legend REPL (test)';

export async function activate(context: ExtensionContext) {
  const version = context.extension.packageJSON.version;
  const replJar = `legend-repl-${version}.jar`;
  if (!existsSync(context.asAbsolutePath(replJar))) {
    const replJarDownloadUrl = (
      workspace.getConfiguration('repl').get('jarDownloadUrl') as string
    ).replace('{{version}}', version);
    window.showInformationMessage(
      `Downloading REPL JAR from: ${replJarDownloadUrl} ...`,
    );
    execSync(
      `curl -L ${replJarDownloadUrl} -o ${context.asAbsolutePath(replJar)}`,
    );
  }

  let port = 9006;
  await import('get-port').then(async (module) => {
    port = await module.default();
  });

  const provider = window.registerTerminalProfileProvider(
    'legend-repl-test.terminal.repl',
    {
      provideTerminalProfile(
        token: CancellationToken,
      ): ProviderResult<TerminalProfile> {
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
              `-Dlegend.repl.dataCube.gridLicenseKey=${workspace
                .getConfiguration('repl')
                .get('agGridLicense', '')}`,
              '-jar',
              context.asAbsolutePath(replJar),
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

  context.subscriptions.push(provider);
}

export function deactivate(): void {
  // do nothing
}
