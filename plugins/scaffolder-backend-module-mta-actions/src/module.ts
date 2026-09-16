import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';

const CATALOG_SYNC_WAIT_MS = 12000;

interface RegisterAppResponse {
  id: string;
  name: string;
  repoUrl: string;
  rootPath?: string;
  status: string;
}

export const scaffolderModuleMtaActions = createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'mta-actions',
  register(reg) {
    reg.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        logger: coreServices.logger,
        discovery: coreServices.discovery,
      },
      async init({ scaffolder, logger, discovery }) {
        logger.info('MTA Scaffolder Actions: registering mta:register-application');

        scaffolder.addActions(
          createTemplateAction<{
            repoUrl: string;
            rootPath?: string;
          }>({
            id: 'mta:register-application',
            description:
              'Register an application with the Migration Toolkit for Applications and wait for technology discovery',
            schema: {
              input: {
                type: 'object',
                required: ['repoUrl'],
                properties: {
                  repoUrl: {
                    type: 'string',
                    title: 'Repository URL',
                    description: 'The Git repository URL of the application',
                  },
                  rootPath: {
                    type: 'string',
                    title: 'Application Root Path',
                    description:
                      'Optional path within the repository to the application root directory',
                  },
                },
              },
              output: {
                type: 'object',
                properties: {
                  applicationId: {
                    type: 'string',
                    title: 'Application ID',
                  },
                  applicationName: {
                    type: 'string',
                    title: 'Application Name',
                  },
                  entityRef: {
                    type: 'string',
                    title: 'Entity Reference',
                  },
                  message: {
                    type: 'string',
                    title: 'Result Message',
                  },
                },
              },
            },
            async handler(ctx) {
              const { repoUrl, rootPath } = ctx.input;

              let mockHubUrl: string;
              try {
                mockHubUrl = await discovery.getBaseUrl('mta-mock-hub');
              } catch {
                mockHubUrl = 'http://localhost:7007/api/mta-mock-hub';
                ctx.logger.warn(
                  `Could not resolve mta-mock-hub URL, using fallback: ${mockHubUrl}`,
                );
              }

              ctx.logger.info(`Registering application with MTA Hub: ${repoUrl}`);
              const body: { repoUrl: string; rootPath?: string } = { repoUrl };
              if (rootPath) {
                body.rootPath = rootPath;
              }

              const response = await fetch(`${mockHubUrl}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
              });

              if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                  `MTA registration failed: ${response.status} — ${errorText}`,
                );
              }

              const app = (await response.json()) as RegisterAppResponse;
              ctx.logger.info(`Application registered: ${app.name} (${app.id})`);

              ctx.logger.info('Waiting for catalog sync...');
              await new Promise<void>(resolve => {
                setTimeout(resolve, CATALOG_SYNC_WAIT_MS);
              });
              ctx.logger.info(
                'Catalog sync wait complete. Application should now be visible in the Software Catalog.',
              );

              const sanitizedName = app.name
                .toLowerCase()
                .replace(/[^a-z0-9-]/g, '-')
                .replace(/-+/g, '-')
                .replace(/^-|-$/g, '')
                .substring(0, 63);

              ctx.output('applicationId', app.id);
              ctx.output('applicationName', sanitizedName);
              ctx.output('entityRef', `component:default/${sanitizedName}`);
              ctx.output(
                'message',
                `Application "${app.name}" registered successfully.`,
              );
            },
          }),
        );
      },
    });
  },
});
