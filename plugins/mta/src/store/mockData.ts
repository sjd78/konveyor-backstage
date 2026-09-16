/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import type {
  Archetype,
  TargetProfile,
  MtaApplication,
  MigrationIssue,
  ActionHistoryEntry,
  DeploymentAsset,
  DevSpacesConfig,
  SupportContact,
} from '../types';

export const SUPPORT_CONTACT: SupportContact = {
  name: 'Enterprise Architecture',
  email: 'enterprise-arch@corp.com',
};

// ---------------------------------------------------------------------------
// Mock issue templates for analysis completion
// ---------------------------------------------------------------------------

const javaEeIssueTemplates: Omit<MigrationIssue, 'id' | 'appId'>[] = [
  {
    severity: 'critical',
    category: 'api-change',
    description:
      'javax.ejb.SessionBean replaced by jakarta.ejb.SessionBean in Jakarta EE',
    file: 'src/main/java/com/app/service/AppBean.java',
    line: 42,
    aiFixAvailable: true,
    problem:
      'EJB SessionBean interface uses the legacy javax.ejb package, which is removed in Jakarta EE 10.',
    impact:
      'The application will not compile on Quarkus or any Jakarta EE 10 runtime. javax.ejb classes are entirely absent.',
    fixGuidance:
      'Replace javax.ejb.SessionBean with CDI @ApplicationScoped bean pattern. Consider migrating to RESTEasy Reactive for service endpoints.',
  },
  {
    severity: 'critical',
    category: 'api-change',
    description:
      'javax.persistence.Entity replaced by jakarta.persistence.Entity',
    file: 'src/main/java/com/app/model/DataModel.java',
    line: 8,
    aiFixAvailable: true,
    problem:
      'javax.persistence imports will not resolve on the Quarkus runtime.',
    impact:
      'Quarkus uses Jakarta Persistence (jakarta.persistence) namespace. The old javax imports fail at compile time, blocking application startup.',
    fixGuidance:
      'Replace all javax.persistence imports with jakarta.persistence equivalents. Can be resolved automatically and will update all 23 occurrences.',
  },
  {
    severity: 'critical',
    category: 'dependency',
    description:
      'hibernate-core 5.x not supported on target platform, upgrade to 6.x',
    file: 'pom.xml',
    line: 67,
    aiFixAvailable: false,
    problem:
      'Hibernate ORM 5.x is not compatible with Quarkus. Quarkus requires Hibernate ORM 6.x with Jakarta Persistence.',
    impact:
      'The application will fail to start due to incompatible Hibernate version. Quarkus manages its own Hibernate extension.',
    fixGuidance:
      'Replace hibernate-core dependency with quarkus-hibernate-orm Quarkus extension. Update pom.xml to use Quarkus BOM for dependency management.',
  },
  {
    severity: 'major',
    category: 'configuration',
    description:
      'persistence.xml uses deprecated Hibernate dialect org.hibernate.dialect.MySQL5Dialect',
    file: 'src/main/resources/META-INF/persistence.xml',
    line: 12,
    aiFixAvailable: true,
    problem:
      'Deprecated org.hibernate.dialect.MySQL5Dialect used in persistence configuration.',
    impact:
      'Quarkus uses application.properties for Hibernate configuration, not persistence.xml. The dialect format has also changed.',
    fixGuidance:
      'Move Hibernate configuration to Quarkus application.properties. Use quarkus.hibernate-orm.dialect property with the updated dialect name.',
  },
  {
    severity: 'major',
    category: 'code-pattern',
    description:
      'EJB @Stateless annotation requires migration to CDI @ApplicationScoped',
    file: 'src/main/java/com/app/service/BusinessService.java',
    line: 15,
    aiFixAvailable: true,
    problem: 'EJB @Stateless annotation is not available in Quarkus.',
    impact:
      'Quarkus uses CDI for dependency injection. EJB annotations must be replaced with CDI equivalents for proper bean lifecycle management.',
    fixGuidance:
      'Replace @Stateless with @ApplicationScoped. Add @Transactional if the bean requires transaction management. Remove EJB-specific interface implementations.',
  },
  {
    severity: 'minor',
    category: 'deployment',
    description:
      'jboss-deployment-structure.xml is not applicable to target platform',
    file: 'src/main/webapp/WEB-INF/jboss-deployment-structure.xml',
    line: 1,
    aiFixAvailable: false,
    problem: 'JBoss-specific deployment descriptor not used by Quarkus.',
    impact:
      'Quarkus does not use JBoss module system. The file will be ignored but adds confusion.',
    fixGuidance:
      'Remove the file. Any module dependencies should become Maven dependencies in pom.xml.',
  },
];

const springIssueTemplates: Omit<MigrationIssue, 'id' | 'appId'>[] = [
  {
    severity: 'critical',
    category: 'dependency',
    description:
      'Spring MVC 4.x EOL. Upgrade to Spring Boot 3.x with Spring MVC 6',
    file: 'pom.xml',
    line: 34,
    aiFixAvailable: false,
  },
  {
    severity: 'major',
    category: 'api-change',
    description: 'javax.servlet.* imports must migrate to jakarta.servlet.*',
    file: 'src/main/java/com/app/controller/AppController.java',
    line: 5,
    aiFixAvailable: true,
  },
  {
    severity: 'major',
    category: 'configuration',
    description:
      'application.properties datasource config needs Spring Boot 3.x format',
    file: 'src/main/resources/application.properties',
    line: 18,
    aiFixAvailable: true,
  },
  {
    severity: 'minor',
    category: 'code-pattern',
    description:
      'WebMvcConfigurerAdapter deprecated. Extend WebMvcConfigurer directly',
    file: 'src/main/java/com/app/config/WebConfig.java',
    line: 10,
    aiFixAvailable: true,
  },
];

const nodeIssueTemplates: Omit<MigrationIssue, 'id' | 'appId'>[] = [
  {
    severity: 'critical',
    category: 'dependency',
    description: 'Node.js 14.x reached end-of-life. Upgrade to Node.js 20 LTS',
    file: 'package.json',
    line: 3,
    aiFixAvailable: false,
    problem:
      'The application targets Node.js 14.x which reached end-of-life in April 2023 and no longer receives security patches.',
    impact:
      'Running on an unsupported Node.js version exposes the application to unpatched vulnerabilities. Kubernetes base images for Node 14 are no longer maintained.',
    fixGuidance:
      'Update the engines field in package.json to ">=20". Test with Node.js 20 LTS locally before deploying. Review breaking changes in Node.js 16, 18, and 20 release notes.',
  },
  {
    severity: 'critical',
    category: 'deployment',
    description: 'No container image defined for Kubernetes deployment',
    file: 'k8s/deployment.yaml',
    line: 18,
    aiFixAvailable: true,
    problem:
      'The Kubernetes deployment manifest references a container image that does not exist in any configured registry.',
    impact:
      'Pod creation will fail with ImagePullBackOff. The application cannot be deployed to the target cluster.',
    fixGuidance:
      'Configure the container image reference to point to the correct registry path. Ensure the CI/CD pipeline builds and pushes the image before deployment.',
  },
  {
    severity: 'major',
    category: 'configuration',
    description: 'Dockerfile not found. Containerization requires a Dockerfile',
    file: '.',
    line: 0,
    aiFixAvailable: true,
    problem:
      'No Dockerfile exists in the project root. A Dockerfile is required to build a container image for Kubernetes deployment.',
    impact:
      'Without a Dockerfile, the CI/CD pipeline cannot build a container image. The application cannot be containerized.',
    fixGuidance:
      'Generate a multi-stage Dockerfile using the UBI 9 Node.js base image. Include dependency installation, build step, and production-optimized runtime stage.',
  },
  {
    severity: 'major',
    category: 'deployment',
    description:
      'Health check endpoints missing for Kubernetes liveness/readiness probes',
    file: 'src/server.ts',
    line: 1,
    aiFixAvailable: true,
    problem:
      'The Express application does not expose /healthz or /readyz endpoints for Kubernetes probe configuration.',
    impact:
      'Without health checks, Kubernetes cannot detect unhealthy pods or manage rolling updates safely. Pods may serve traffic before they are ready.',
    fixGuidance:
      'Add GET /healthz (liveness) and GET /readyz (readiness) endpoints. The readiness probe should verify database and downstream service connectivity.',
  },
  {
    severity: 'major',
    category: 'dependency',
    description:
      'Express 4.x has known security vulnerabilities in dependencies',
    file: 'package.json',
    line: 12,
    aiFixAvailable: true,
    problem:
      'The installed version of Express 4.x pulls in transitive dependencies with known CVEs.',
    impact:
      'Production deployments may be flagged by vulnerability scanners. Some CVEs allow request smuggling or denial of service.',
    fixGuidance:
      'Run npm audit fix to patch transitive dependencies. If major version bumps are needed, review the Express 5 migration guide.',
  },
  {
    severity: 'major',
    category: 'code-pattern',
    description: 'No graceful shutdown handler for SIGTERM signal',
    file: 'src/server.ts',
    line: 45,
    aiFixAvailable: true,
    problem:
      'The application does not handle SIGTERM, which Kubernetes sends before terminating a pod.',
    impact:
      'In-flight requests will be dropped during rolling updates or pod evictions. Database connections may not close cleanly.',
    fixGuidance:
      'Add a SIGTERM handler that stops accepting new connections, waits for in-flight requests to complete, closes database pools, then exits.',
  },
  {
    severity: 'minor',
    category: 'configuration',
    description: 'Environment variables should use ConfigMap/Secret references',
    file: 'src/config.ts',
    line: 5,
    aiFixAvailable: true,
    problem:
      'Application configuration reads environment variables directly without Kubernetes ConfigMap or Secret references.',
    impact:
      'Configuration changes require redeployment. Sensitive values like API keys are not managed through Kubernetes Secrets.',
    fixGuidance:
      'Reference environment variables from ConfigMap and Secret objects in the deployment manifest. Separate sensitive values into Secrets.',
  },
  {
    severity: 'minor',
    category: 'code-pattern',
    description:
      'Console.log statements should be replaced with structured logging',
    file: 'src/utils/logger.ts',
    line: 8,
    aiFixAvailable: false,
    problem:
      'The application uses console.log for logging, which produces unstructured text output.',
    impact:
      'Unstructured logs are difficult to parse in centralized logging systems like OpenShift Logging or Elasticsearch.',
    fixGuidance:
      'Replace console.log with a structured logging library like pino or winston. Output JSON-formatted logs with level, timestamp, and correlation IDs.',
  },
];

const issueTemplatesByArchetype: Record<
  string,
  Omit<MigrationIssue, 'id' | 'appId'>[]
> = {
  'arch-1': javaEeIssueTemplates,
  'arch-2': springIssueTemplates,
  'arch-3': nodeIssueTemplates,
};

export function generateMockIssues(
  appId: string,
  archetypeId: string,
  nextIdFn: (prefix: string) => string,
): MigrationIssue[] {
  const templates =
    issueTemplatesByArchetype[archetypeId] ?? javaEeIssueTemplates;
  return templates.map(t => ({ ...t, id: nextIdFn('issue'), appId }));
}

// ---------------------------------------------------------------------------
// Initial mock data
// ---------------------------------------------------------------------------

export const initialArchetypes: Archetype[] = [
  {
    id: 'arch-1',
    name: 'Legacy Java EE',
    description:
      'Traditional Java EE application with JPA and JSON-P APIs',
    criteriaTags: ['JPA entities', 'Java EE JSON-P'],
    icon: 'StorageIcon',
  },
];

export const initialTargetProfiles: TargetProfile[] = [
  {
    id: 'target-1',
    name: 'Quarkus on OpenShift',
    description:
      'Modernize Java EE applications to Quarkus with cloud-native optimizations for OpenShift',
    platform: 'OpenShift',
    analysisProfileName: 'Quarkus on OpenShift',
    analysisTargets: [
      'containerization',
      'quarkus3',
      'openjdk21',
      'corporate-rules',
    ],
    generatorName: 'Quarkus OpenShift Generator',
  },
  {
    id: 'target-2',
    name: 'EAP 8 on traditional infra',
    description:
      'Upgrade to JBoss EAP 8 with Jakarta EE 10 on existing traditional infrastructure',
    platform: 'Traditional',
    analysisProfileName: 'EAP 8 on traditional infra',
    analysisTargets: ['eap8', 'jakarta-ee10', 'openjdk21', 'corporate-rules'],
    generatorName: 'EAP 8 Deployment Generator',
  },
];

export const initialApplications: MtaApplication[] = [
  {
    id: 'app-1',
    name: 'inventory-service',
    repoUrl: 'https://github.com/konveyor-ecosystem/inventory-service',
    discoveredTags: [
      'JPA entities',
      'Java EE JSON-P',
    ],
    archetypeId: 'arch-1',
    targetProfileId: 'target-1',
    status: 'Active',
    totalIssuesDiscovered: 56,
    issuesCount: 42,
    criticalIssues: 8,
    storyPoints: 18,
    filesAffected: 127,
    entityRef: 'component:default/inventory-service',
    devSpacesAvailable: true,
    devSpacesActive: true,
    devSpacesUser: 'developer',
    devSpacesStartedAt: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: 'app-2',
    name: 'order-management',
    repoUrl: 'https://github.com/konveyor-ecosystem/order-management',
    discoveredTags: [
      'JPA entities',
      'Java EE JSON-P',
    ],
    archetypeId: 'arch-1',
    targetProfileId: 'target-2',
    status: 'Analysis',
    totalIssuesDiscovered: 23,
    issuesCount: 23,
    criticalIssues: 3,
    storyPoints: 11,
    filesAffected: 64,
    entityRef: 'component:default/order-management',
    devSpacesAvailable: true,
  },
  {
    id: 'app-3',
    name: 'customer-portal',
    repoUrl: 'https://github.com/konveyor-ecosystem/customer-portal',
    discoveredTags: [
      'JPA entities',
      'Java EE JSON-P',
      'EJB components',
      'JSP pages',
    ],
    archetypeId: 'arch-1',
    targetProfileId: 'target-1',
    status: 'Post-remediation',
    totalIssuesDiscovered: 4,
    issuesCount: 2,
    criticalIssues: 1,
    storyPoints: 4,
    filesAffected: 4,
    entityRef: 'component:default/customer-portal',
    devSpacesAvailable: true,
    devSpacesActive: true,
    devSpacesUser: 'developer',
    devSpacesStartedAt: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    id: 'app-4',
    name: 'notification-hub',
    repoUrl: 'https://github.com/konveyor-ecosystem/notification-hub',
    discoveredTags: [
      'JPA entities',
      'Java EE JSON-P',
      'JBoss EAP 7',
    ],
    archetypeId: 'arch-1',
    targetProfileId: 'target-2',
    status: 'Completed',
    totalIssuesDiscovered: 7,
    issuesCount: 0,
    criticalIssues: 0,
    storyPoints: 0,
    filesAffected: 22,
    entityRef: 'component:default/notification-hub',
    devSpacesAvailable: true,
  },
  {
    id: 'app-5',
    name: 'data-pipeline',
    repoUrl: 'https://github.com/konveyor-ecosystem/data-pipeline',
    discoveredTags: [
      'JPA entities',
      'Java EE JSON-P',
    ],
    archetypeId: 'arch-1',
    targetProfileId: 'target-1',
    status: 'Not Started',
    totalIssuesDiscovered: 0,
    issuesCount: 0,
    criticalIssues: 0,
    storyPoints: 0,
    filesAffected: 0,
    entityRef: 'component:default/data-pipeline',
    devSpacesAvailable: false,
  },
];

export const initialIssues: MigrationIssue[] = [
  // inventory-service (app-1)
  {
    id: 'issue-1',
    appId: 'app-1',
    severity: 'critical',
    category: 'api-change',
    description:
      'javax.ejb.SessionBean replaced by jakarta.ejb.SessionBean in Jakarta EE',
    file: 'src/main/java/com/app/service/OrderBean.java',
    line: 42,
    aiFixAvailable: true,
    problem:
      'EJB SessionBean interface uses the legacy javax.ejb package, removed in Jakarta EE 10.',
    impact:
      'Application will not compile on Quarkus. javax.ejb classes are entirely absent from the runtime.',
    fixGuidance:
      'Replace javax.ejb.SessionBean with CDI @ApplicationScoped bean pattern. Consider migrating to RESTEasy Reactive.',
  },
  {
    id: 'issue-2',
    appId: 'app-1',
    severity: 'critical',
    category: 'api-change',
    description:
      'javax.persistence.Entity replaced by jakarta.persistence.Entity',
    file: 'src/main/java/com/app/model/Inventory.java',
    line: 8,
    aiFixAvailable: true,
    problem:
      'javax.persistence imports will not resolve on the Quarkus runtime.',
    impact:
      'Quarkus uses Jakarta Persistence (jakarta.persistence) namespace. Old javax imports fail at compile time.',
    fixGuidance:
      'Replace all javax.persistence imports with jakarta.persistence equivalents. Can be resolved automatically and will update all 23 occurrences.',
  },
  {
    id: 'issue-3',
    appId: 'app-1',
    severity: 'critical',
    category: 'dependency',
    description: 'hibernate-core 5.x not supported on Quarkus, upgrade to 6.x',
    file: 'pom.xml',
    line: 67,
    aiFixAvailable: false,
    problem:
      'Hibernate ORM 5.x is not compatible with Quarkus. Quarkus requires Hibernate ORM 6.x.',
    impact:
      'Application will fail to start due to incompatible Hibernate version.',
    fixGuidance:
      'Replace hibernate-core dependency with quarkus-hibernate-orm extension. Update pom.xml to use Quarkus BOM.',
  },
  {
    id: 'issue-4',
    appId: 'app-1',
    severity: 'major',
    category: 'configuration',
    description:
      'persistence.xml uses deprecated Hibernate dialect org.hibernate.dialect.MySQL5Dialect',
    file: 'src/main/resources/META-INF/persistence.xml',
    line: 12,
    aiFixAvailable: true,
    problem:
      'Deprecated org.hibernate.dialect.MySQL5Dialect used in persistence configuration.',
    impact:
      'Quarkus uses application.properties for Hibernate config, not persistence.xml.',
    fixGuidance:
      'Move Hibernate configuration to application.properties. Use quarkus.hibernate-orm.dialect property.',
  },
  {
    id: 'issue-5',
    appId: 'app-1',
    severity: 'major',
    category: 'code-pattern',
    description:
      'EJB @Stateless annotation requires migration to CDI @ApplicationScoped',
    file: 'src/main/java/com/app/service/InventoryService.java',
    line: 15,
    aiFixAvailable: true,
    problem: 'EJB @Stateless annotation is not available in Quarkus.',
    impact:
      'Quarkus uses CDI for dependency injection. EJB annotations must be replaced for proper lifecycle management.',
    fixGuidance:
      'Replace @Stateless with @ApplicationScoped. Add @Transactional if transaction management is needed.',
  },
  {
    id: 'issue-6',
    appId: 'app-1',
    severity: 'minor',
    category: 'configuration',
    description:
      'web.xml servlet mappings should be converted to JAX-RS annotations',
    file: 'src/main/webapp/WEB-INF/web.xml',
    line: 23,
    aiFixAvailable: true,
    problem: 'Traditional web.xml servlet mappings are not used in Quarkus.',
    impact:
      'Quarkus does not process web.xml. URL routing must use JAX-RS annotations.',
    fixGuidance:
      'Convert servlet mappings to @Path annotations on REST resources. Remove web.xml after migration.',
  },
  {
    id: 'issue-7',
    appId: 'app-1',
    severity: 'minor',
    category: 'deployment',
    description: 'jboss-deployment-structure.xml is not applicable to Quarkus',
    file: 'src/main/webapp/WEB-INF/jboss-deployment-structure.xml',
    line: 1,
    aiFixAvailable: false,
    problem: 'JBoss-specific deployment descriptor not used by Quarkus.',
    impact: 'File will be ignored but adds confusion to the project.',
    fixGuidance:
      'Remove the file. Any module dependencies should become Maven dependencies.',
  },
  {
    id: 'issue-8',
    appId: 'app-1',
    severity: 'info',
    category: 'code-pattern',
    description: 'Consider replacing JSP views with Qute templates for Quarkus',
    file: 'src/main/webapp/views/inventory.jsp',
    line: 1,
    aiFixAvailable: false,
    problem:
      'JSP is a legacy view technology not natively supported by Quarkus.',
    impact:
      'Quarkus natively supports Qute templates with better performance and developer experience.',
    fixGuidance:
      'Convert JSP files to Qute templates. Qute provides type-safe template expressions and reactive rendering.',
  },
  // order-management (app-2)
  {
    id: 'issue-9',
    appId: 'app-2',
    severity: 'critical',
    category: 'dependency',
    description:
      'Spring MVC 4.x EOL - upgrade to Spring Boot 3.x with Spring MVC 6',
    file: 'pom.xml',
    line: 34,
    aiFixAvailable: false,
  },
  {
    id: 'issue-10',
    appId: 'app-2',
    severity: 'major',
    category: 'api-change',
    description: 'javax.servlet.* imports must migrate to jakarta.servlet.*',
    file: 'src/main/java/com/app/controller/OrderController.java',
    line: 5,
    aiFixAvailable: true,
  },
  {
    id: 'issue-11',
    appId: 'app-2',
    severity: 'major',
    category: 'configuration',
    description:
      'application.properties datasource config needs Spring Boot 3.x format',
    file: 'src/main/resources/application.properties',
    line: 18,
    aiFixAvailable: true,
  },
  {
    id: 'issue-12',
    appId: 'app-2',
    severity: 'minor',
    category: 'code-pattern',
    description:
      'WebMvcConfigurerAdapter deprecated - extend WebMvcConfigurer directly',
    file: 'src/main/java/com/app/config/WebConfig.java',
    line: 10,
    aiFixAvailable: true,
  },
  // customer-portal (app-3): Remediation status, AI fixes already applied
  {
    id: 'issue-13',
    appId: 'app-3',
    severity: 'critical',
    category: 'api-change',
    description:
      'javax.jms.ConnectionFactory replaced by jakarta.jms.ConnectionFactory',
    file: 'src/main/java/com/app/messaging/NotificationSender.java',
    line: 22,
    aiFixAvailable: true,
  },
  {
    id: 'issue-14',
    appId: 'app-3',
    severity: 'critical',
    category: 'dependency',
    description:
      'JBoss EAP 7.x modules not compatible with EAP 8. Review module dependencies',
    file: 'src/main/webapp/WEB-INF/jboss-deployment-structure.xml',
    line: 5,
    aiFixAvailable: false,
  },
  {
    id: 'issue-15',
    appId: 'app-3',
    severity: 'major',
    category: 'code-pattern',
    description:
      'EJB @MessageDriven requires migration to Jakarta Messaging 3.1 annotations',
    file: 'src/main/java/com/app/messaging/OrderListener.java',
    line: 8,
    aiFixAvailable: true,
  },
  {
    id: 'issue-16',
    appId: 'app-3',
    severity: 'minor',
    category: 'configuration',
    description:
      'standalone-full.xml JMS subsystem config needs EAP 8 schema update',
    file: 'configuration/standalone-full.xml',
    line: 142,
    aiFixAvailable: false,
  },
];

const now = Date.now();
const day = 86400000;

export const initialActionHistory: ActionHistoryEntry[] = [
  {
    id: 'action-1',
    appId: 'app-1',
    action: 'run-analysis',
    timestamp: new Date(now - 7 * day).toISOString(),
    status: 'completed',
    triggeredBy: 'architect',
  },
  {
    id: 'action-4',
    appId: 'app-2',
    action: 'run-analysis',
    timestamp: new Date(now - 6 * day).toISOString(),
    status: 'completed',
    triggeredBy: 'architect',
  },
  {
    id: 'action-5',
    appId: 'app-3',
    action: 'run-analysis',
    timestamp: new Date(now - 4 * day).toISOString(),
    status: 'completed',
    triggeredBy: 'architect',
  },
  {
    id: 'action-6',
    appId: 'app-3',
    action: 'trigger-ai-remediator',
    timestamp: new Date(now - 2 * day).toISOString(),
    status: 'completed',
    triggeredBy: 'architect',
  },
  {
    id: 'action-6b',
    appId: 'app-3',
    action: 'launch-workspace',
    timestamp: new Date(now - 0.03 * day).toISOString(),
    status: 'completed',
    triggeredBy: 'architect',
  },
  {
    id: 'action-7',
    appId: 'app-4',
    action: 'run-analysis',
    timestamp: new Date(now - 8 * day).toISOString(),
    status: 'completed',
    triggeredBy: 'architect',
  },
  {
    id: 'action-8',
    appId: 'app-4',
    action: 'apply-quick-fixes',
    timestamp: new Date(now - 6 * day).toISOString(),
    status: 'completed',
    triggeredBy: 'developer',
  },
];

// ---------------------------------------------------------------------------
// Discovery tag sets
// ---------------------------------------------------------------------------

const javaEeTags = [
  'JPA entities',
  'Java EE JSON-P',
];

export function tagsForUrl(_repoUrl: string): string[] {
  return javaEeTags;
}

// ---------------------------------------------------------------------------
// Deployment assets and Dev Spaces config
// ---------------------------------------------------------------------------

export const DEFAULT_DEVSPACES_CONFIG: DevSpacesConfig = {
  namespace: 'mta-workspaces',
  memory: '4 Gi',
  storage: '10 Gi',
  idleTimeout: '30 min',
  extensions: ['MTA Analysis', 'Red Hat Java', 'AI Code Assistant'],
  features: [
    'Corporate rules synced',
    'Analysis context loaded',
    'AI assistant pre-populated',
  ],
};

export const DEPLOYMENT_ASSETS: DeploymentAsset[] = [
  { name: 'Dockerfile', path: '/', type: 'container' },
  { name: 'pipeline.yaml', path: '/.tekton/', type: 'ci-cd' },
  { name: 'deployment.yaml', path: '/k8s/', type: 'kubernetes' },
  { name: 'service.yaml', path: '/k8s/', type: 'kubernetes' },
  { name: 'route.yaml', path: '/k8s/', type: 'openshift' },
];

export const DEPLOYMENT_ASSET_PREVIEWS: Record<string, string> = {
  Dockerfile: `FROM registry.access.redhat.com/ubi9/openjdk-21:latest AS builder
WORKDIR /app
COPY pom.xml .
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn package -DskipTests -B

FROM registry.access.redhat.com/ubi9/openjdk-21-runtime:latest
COPY --from=builder /app/target/*.jar /app/app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]`,
  'pipeline.yaml': `apiVersion: tekton.dev/v1beta1
kind: Pipeline
metadata:
  name: build-and-deploy
spec:
  tasks:
    - name: build
      taskRef:
        name: buildah
    - name: deploy
      taskRef:
        name: openshift-client
      runAfter: [build]`,
  'deployment.yaml': `apiVersion: apps/v1
kind: Deployment
metadata:
  name: inventory-service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: inventory-service
  template:
    spec:
      containers:
        - name: app
          image: image-registry.openshift-image-registry.svc:5000/mta/inventory-service:latest
          ports:
            - containerPort: 8080
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"`,
  'service.yaml': `apiVersion: v1
kind: Service
metadata:
  name: inventory-service
spec:
  selector:
    app: inventory-service
  ports:
    - port: 8080
      targetPort: 8080`,
  'route.yaml': `apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: inventory-service
spec:
  to:
    kind: Service
    name: inventory-service
  port:
    targetPort: 8080
  tls:
    termination: edge`,
};
