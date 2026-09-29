import type {
  KonveyorApplication,
  KonveyorArchetype,
  KonveyorIncident,
  KonveyorInsight,
  KonveyorTask,
} from '../service/types';

export const SEED_APPLICATIONS: KonveyorApplication[] = [
  {
    id: 1,
    name: 'inventory-service',
    description:
      'Java-based inventory management service being migrated from JBoss EAP to Quarkus',
    repository: {
      kind: 'git',
      url: 'https://github.com/konveyor-ecosystem/inventory-service',
      branch: 'main',
    },
    tags: [
      { id: 10, name: 'Java', category: { id: 1, name: 'Language' } },
      { id: 11, name: 'JBoss EAP', category: { id: 2, name: 'Framework' } },
      { id: 12, name: 'Quarkus', category: { id: 3, name: 'Target' } },
    ],
    tasks: [101],
  },
  {
    id: 2,
    name: 'order-management',
    description:
      'Spring Boot order processing service targeted for containerization on OpenShift',
    repository: {
      kind: 'git',
      url: 'https://github.com/konveyor-ecosystem/order-management',
      branch: 'main',
    },
    tags: [
      { id: 10, name: 'Java', category: { id: 1, name: 'Language' } },
      { id: 13, name: 'Spring Boot', category: { id: 2, name: 'Framework' } },
      { id: 14, name: 'Cloud Readiness', category: { id: 3, name: 'Target' } },
    ],
    tasks: [102],
  },
  {
    id: 3,
    name: 'customer-portal',
    description:
      'Java EE customer portal with EJB messaging and JSP views targeted for EAP 8 migration',
    repository: {
      kind: 'git',
      url: 'https://github.com/konveyor-ecosystem/customer-portal',
      branch: 'main',
    },
    tags: [
      { id: 10, name: 'Java', category: { id: 1, name: 'Language' } },
      { id: 11, name: 'JBoss EAP', category: { id: 2, name: 'Framework' } },
    ],
    tasks: [103],
  },
  {
    id: 4,
    name: 'notification-hub',
    description:
      'Java EE notification service with JMS messaging being migrated from EAP 7 to EAP 8',
    repository: {
      kind: 'git',
      url: 'https://github.com/konveyor-ecosystem/notification-hub',
      branch: 'main',
    },
    tags: [
      { id: 10, name: 'Java', category: { id: 1, name: 'Language' } },
      { id: 15, name: 'Kafka', category: { id: 4, name: 'Messaging' } },
    ],
    tasks: [104],
  },
];

export const SEED_ARCHETYPES: KonveyorArchetype[] = [
  {
    id: 1,
    name: 'JBoss EAP to Quarkus',
    description: 'Modernize traditional JBoss EAP enterprise applications to Quarkus',
    criteria: [
      { id: 10, name: 'Java' },
      { id: 11, name: 'JBoss EAP' },
    ],
    tags: [{ id: 12, name: 'Quarkus' }],
    profiles: [
      {
        id: 1,
        name: 'Quarkus Modernization',
        analysisProfile: { id: 1, name: 'quarkus-rules' },
        generators: [{ id: 1, name: 'quarkus-deployment-generator' }],
      },
    ],
  },
  {
    id: 2,
    name: 'Spring Boot to Quarkus',
    description: 'Migrate Spring Boot microservices to Quarkus cloud-native runtime',
    criteria: [
      { id: 10, name: 'Java' },
      { id: 13, name: 'Spring Boot' },
    ],
    tags: [{ id: 12, name: 'Quarkus' }],
  },
  {
    id: 3,
    name: 'Containerization on OpenShift',
    description: 'Containerize monolithic applications for Red Hat OpenShift',
    criteria: [{ id: 10, name: 'Java' }],
    tags: [{ id: 14, name: 'Cloud Readiness' }],
  },
];

export const SEED_TASKS: Record<number, KonveyorTask> = {
  101: {
    id: 101,
    name: 'Analyze inventory-service',
    addon: 'analyzer',
    state: 'Succeeded',
    application: { id: 1, name: 'inventory-service' },
    started: '2026-09-01T10:00:00Z',
    terminated: '2026-09-01T10:05:00Z',
    data: {
      targets: ['quarkus', 'cloud-readiness'],
      sources: ['eap7'],
    },
  },
  102: {
    id: 102,
    name: 'Analyze order-management',
    addon: 'analyzer',
    state: 'Running',
    application: { id: 2, name: 'order-management' },
    started: '2026-09-01T11:00:00Z',
    data: {
      targets: ['cloud-readiness'],
    },
  },
  103: {
    id: 103,
    name: 'Analyze customer-portal',
    addon: 'analyzer',
    state: 'Succeeded',
    application: { id: 3, name: 'customer-portal' },
    started: '2026-09-01T09:00:00Z',
    terminated: '2026-09-01T09:04:00Z',
  },
  104: {
    id: 104,
    name: 'Analyze notification-hub',
    addon: 'analyzer',
    state: 'Succeeded',
    application: { id: 4, name: 'notification-hub' },
    started: '2026-09-01T08:00:00Z',
    terminated: '2026-09-01T08:03:00Z',
  },
};

export const SEED_INSIGHTS: KonveyorInsight[] = [
  {
    id: 1,
    ruleset: 'quarkus/eap',
    rule: 'javax-to-jakarta-migration',
    name: 'Deprecated Java EE API usage',
    description:
      'Java EE javax.* packages are deprecated in modern runtimes. Migrate to Jakarta EE / Quarkus extensions.',
    category: 'mandatory',
    effort: 3,
    incidents: [{ id: 1001 }, { id: 1002 }],
    links: [
      {
        title: 'Quarkus Migration Guide',
        url: 'https://quarkus.io/guides/migration-guides',
      },
    ],
  },
  {
    id: 2,
    ruleset: 'quarkus/cdi',
    rule: 'jndi-lookup-removal',
    name: 'Hardcoded JNDI lookup',
    description:
      'JNDI lookup is not cloud-native. Replace JNDI lookup with MicroProfile Config or CDI injection.',
    category: 'mandatory',
    effort: 5,
    incidents: [{ id: 1003 }],
  },
  {
    id: 3,
    ruleset: 'quarkus/ejb',
    rule: 'stateful-ejb-migration',
    name: 'EJB Session Bean usage',
    description:
      'Stateful EJB session beans do not scale horizontally in Kubernetes. Refactor to stateless services.',
    category: 'potential',
    effort: 8,
    incidents: [{ id: 1004 }],
  },
];

export const SEED_INCIDENTS: Record<number, KonveyorIncident[]> = {
  1: [
    {
      id: 1001,
      insight: 1,
      file: 'src/main/java/com/example/inventory/OrderService.java',
      line: 45,
      message:
        'javax.ejb.Stateless is deprecated, use CDI @ApplicationScoped instead',
      codeSnip: '@Stateless\npublic class OrderService {',
    },
    {
      id: 1002,
      insight: 1,
      file: 'src/main/java/com/example/inventory/ItemCatalog.java',
      line: 78,
      message: 'javax.transaction.UserTransaction usage should be replaced with @Transactional',
      codeSnip: 'userTransaction.begin();',
    },
  ],
  2: [
    {
      id: 1003,
      insight: 2,
      file: 'src/main/java/com/example/inventory/DBUtil.java',
      line: 23,
      message: 'InitialContext.lookup is not cloud-native; use Agroal DataSource injection',
      codeSnip: 'Context ctx = new InitialContext();\nDataSource ds = (DataSource) ctx.lookup("java:comp/env/jdbc/mydb");',
    },
  ],
  3: [
    {
      id: 1004,
      insight: 3,
      file: 'src/main/java/com/example/inventory/InventoryManager.java',
      line: 112,
      message: 'Migrate stateful session bean to stateless service with Redis or database state',
    },
  ],
};
