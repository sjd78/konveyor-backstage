import type {
  KonveyorAnalysis,
  KonveyorAnalysisProfile,
  KonveyorApplication,
  KonveyorIncident,
  KonveyorInsight,
  KonveyorTask,
} from '../../src/api';

/*
 * Data derived from real responses of a local Konveyor Hub captured on
 * 2026-11-04. Names, descriptions, links, files, lines, messages and Hub
 * errors are kept as Hub reported them. Values that capture did not contain
 * (a running discovery, a failed analysis) use the same shape so the gallery
 * can reach every state. Code snippets are excerpts.
 */
// cspell:ignore fasterxml javaee ordermanagement Pageable pathspec springframework

/** Application 1, discovery and analysis succeeded with profile 1. Hub reported 35 tags; six keep the tile readable. */
export const hubApplication: KonveyorApplication = {
  id: 1,
  name: 'Backstage Phase 2 Spring',
  description: 'konveyor-backstage verification',
  createTime: '2026-11-04T11:14:18.424825841Z',
  repository: {
    kind: 'git',
    url: 'https://github.com/konveyor/example-applications.git',
    branch: 'main',
    tag: '',
    path: 'example-1',
  },
  tags: [
    {
      id: 70,
      name: 'Servlet',
      source: 'tech-discovery',
    },
    {
      id: 79,
      name: 'Micrometer',
      source: 'tech-discovery',
    },
    {
      id: 115,
      name: 'Spring DI',
      source: 'tech-discovery',
    },
    {
      id: 188,
      name: 'Spring MVC',
      source: 'tech-discovery',
    },
    {
      id: 215,
      name: 'Spring Boot Actuator',
      source: 'tech-discovery',
    },
    {
      id: 233,
      name: 'Properties',
      source: 'tech-discovery',
    },
  ],
  archetypes: [
    {
      id: 1,
      name: 'Java modernization',
    },
  ],
};

/** Application 2, language discovery failed on a missing branch. */
export const hubFailingApplication: KonveyorApplication = {
  id: 2,
  name: 'Backstage Phase 2 Failure',
  description: 'konveyor-backstage verification',
  createTime: '2026-11-04T11:14:18.607262121Z',
  repository: {
    kind: 'git',
    url: 'https://github.com/konveyor/example-applications.git',
    branch: 'backstage-phase2-missing-branch',
    tag: '',
    path: 'example-1',
  },
  tags: [],
  archetypes: null,
};

/** The only analysis profile Hub offered for application 1. */
export const hubProfile: KonveyorAnalysisProfile = {
  id: 1,
  name: 'Spring 6',
  description: 'Spring Framework 6 modernization',
  mode: {
    withDeps: true,
  },
  scope: {
    withKnownLibs: false,
  },
  rules: {
    targets: [
      {
        id: 3,
        name: 'Spring Framework',
        selection: 'konveyor.io/target=spring6',
      },
    ],
  },
};

/** Task 1, language discovery succeeded. */
export const hubDiscoverySucceededTask: KonveyorTask = {
  id: 1,
  name: 'Backstage Phase 2 Spring-language-discovery',
  kind: 'language-discovery',
  state: 'Succeeded',
  application: {
    id: 1,
    name: 'Backstage Phase 2 Spring',
  },
  data: {
    source: 'language-discovery',
  },
  addon: 'language-discovery',
  started: '2026-11-04T11:14:19.106712714Z',
  terminated: '2026-11-04T11:16:00.699314937Z',
  activity: [
    '[CMD] /usr/bin/git succeeded.',
    '[CMD] Running: /usr/bin/git pull',
    '[CMD] /usr/bin/git succeeded.',
  ],
};

/** Task 2, tech discovery succeeded. */
export const hubTechDiscoverySucceededTask: KonveyorTask = {
  id: 2,
  name: 'Backstage Phase 2 Spring-tech-discovery',
  kind: 'tech-discovery',
  state: 'Succeeded',
  application: {
    id: 1,
    name: 'Backstage Phase 2 Spring',
  },
  data: {
    mode: {
      discovery: true,
      withDeps: true,
    },
    rules: {
      labels: {
        included: ['discovery'],
      },
    },
    tagger: {
      enabled: true,
      source: 'tech-discovery',
    },
  },
  addon: 'analyzer',
  started: '2026-11-04T11:15:00.160053158Z',
  terminated: '2026-11-04T11:20:36.207532365Z',
  activity: [
    '[ANALYZER] Rule execution complete',
    '[TAG] Tagging Application 1.',
    'Done.',
  ],
};

/** Task 5, analyzer running. Activity is the tail of the 86 Hub lines. */
export const hubAnalysisRunningTask: KonveyorTask = {
  id: 5,
  name: 'application-1-analyzer',
  kind: 'analyzer',
  state: 'Running',
  application: {
    id: 1,
    name: 'Backstage Phase 2 Spring',
  },
  data: {
    profile: {
      id: 1,
    },
    tagger: {
      enabled: true,
    },
    verbosity: 0,
  },
  addon: 'analyzer',
  started: '2026-11-04T11:20:16.745799882Z',
  activity: [
    '[ANALYZER] starting to process 867 rules',
    '[ANALYZER] starting to process 867 rules',
    '[ANALYZER] processed 14 rules out of 867',
  ],
};

/** Task 5, analyzer succeeded. Activity is the tail of the 98 Hub lines. */
export const hubAnalysisSucceededTask: KonveyorTask = {
  id: 5,
  name: 'application-1-analyzer',
  kind: 'analyzer',
  state: 'Succeeded',
  application: {
    id: 1,
    name: 'Backstage Phase 2 Spring',
  },
  data: {
    profile: {
      id: 1,
    },
    tagger: {
      enabled: true,
    },
    verbosity: 0,
  },
  addon: 'analyzer',
  started: '2026-11-04T11:20:16.745799882Z',
  terminated: '2026-11-04T11:23:07.742195693Z',
  activity: [
    'Analysis 1 reported. duration: 16.32857ms',
    'Facts updated.',
    'Done.',
  ],
};

/** Task 3, language discovery failed with the Hub error text. */
export const hubFailedDiscoveryTask: KonveyorTask = {
  id: 3,
  name: 'Backstage Phase 2 Failure-language-discovery',
  kind: 'language-discovery',
  state: 'Failed',
  application: {
    id: 2,
    name: 'Backstage Phase 2 Failure',
  },
  data: {
    source: 'language-discovery',
  },
  addon: 'language-discovery',
  started: '2026-11-04T11:14:20.143900939Z',
  terminated: '2026-11-04T11:16:38.563603373Z',
  errors: [
    {
      severity: 'Error',
      description: 'Container (addon) failed: Error',
    },
    {
      severity: 'Error',
      description:
        "(exit=1) /usr/bin/git checkout backstage-phase2-missing-branch: FAILED, Reason: exit status 1, Output: error: pathspec 'backstage-phase2-missing-branch' did not match any file(s) known to git\n",
    },
  ],
  activity: [
    '[CMD] Running: /usr/bin/git checkout backstage-phase2-missing-branch',
    "[CMD] /usr/bin/git failed: (exit=1) /usr/bin/git checkout backstage-phase2-missing-branch: FAILED, Reason: exit status 1, Output: error: pathspec 'backstage-phase2-missing-branch' did not match any file(s) known to git",
    '> ',
  ],
};

/** Task 4, tech discovery canceled. */
export const hubCanceledDiscoveryTask: KonveyorTask = {
  id: 4,
  name: 'Backstage Phase 2 Failure-tech-discovery',
  kind: 'tech-discovery',
  state: 'Canceled',
  application: {
    id: 2,
    name: 'Backstage Phase 2 Failure',
  },
  data: {
    mode: {
      discovery: true,
      withDeps: true,
    },
    rules: {
      labels: {
        included: ['discovery'],
      },
    },
    tagger: {
      enabled: true,
      source: 'tech-discovery',
    },
  },
  started: '2026-11-04T11:14:20.143900939Z',
  terminated: '2026-11-04T11:16:38.563603373Z',
};

/** The persisted analysis Hub returned for application 1. */
export const hubAnalysis: KonveyorAnalysis = {
  id: 1,
  application: {
    id: 1,
    name: 'Backstage Phase 2 Spring',
  },
  effort: 23,
  createTime: '2026-11-04T11:23:06.742631087Z',
  commit: '41f4e20bbf71fe318b11b173787aa87ba6281aec',
};

/** Twelve findings across critical, major, minor and info, with and without locations, snippets and links. */
export const hubInsights: KonveyorInsight[] = [
  {
    id: 4,
    analysis: 1,
    ruleset: 'eap8/eap7',
    rule: 'javax-to-jakarta-dependencies-00004',
    name: '',
    description:
      'javax.activation groupId has been replaced by jakarta.activation',
    category: 'mandatory',
    effort: 1,
    links: [
      {
        url: 'https://jakarta.ee/',
        title: 'Jakarta EE',
      },
    ],
  },
  {
    id: 5,
    analysis: 1,
    ruleset: 'eap8/eap7',
    rule: 'javax-to-jakarta-import-00001',
    name: '',
    description: "The package 'javax' has been replaced by 'jakarta'.",
    category: 'mandatory',
    effort: 1,
  },
  {
    id: 6,
    analysis: 1,
    ruleset: 'spring-framework',
    rule: 'spring-framework-5.x-to-6.0-baseline-00001',
    name: '',
    description: 'Spring Framework 6.0 must use at least Java 17',
    category: 'potential',
    effort: 1,
    links: [
      {
        url: 'https://github.com/spring-projects/spring-framework/wiki/Upgrading-to-Spring-Framework-6.x#upgrading-to-version-60',
        title: 'Spring 6.0 migration guide',
      },
    ],
  },
  {
    id: 7,
    analysis: 1,
    ruleset: 'spring-framework',
    rule: 'spring-framework-5.x-to-6.0-baseline-00010',
    name: '',
    description: 'Spring Framework 6.0 must use at least JakartaEE 9',
    category: 'potential',
    effort: 1,
    links: [
      {
        url: 'https://github.com/spring-projects/spring-framework/wiki/Upgrading-to-Spring-Framework-6.x#upgrading-to-version-60',
        title: 'Spring 6.0 migration guide',
      },
    ],
  },
  {
    id: 8,
    analysis: 1,
    ruleset: 'spring-framework',
    rule: 'spring-framework-5.x-to-6.0-data-access-00001',
    name: '',
    description: 'Spring 6 must use at least Hibernate 5.6.x',
    category: 'optional',
    effort: 5,
    links: [
      {
        url: 'https://github.com/hibernate/hibernate-orm/blob/5.6/migration-guide.adoc',
        title: 'Hibernate 5.5 to 5.6 migration guide',
      },
      {
        url: 'https://github.com/spring-projects/spring-framework/wiki/Spring-Framework-6.0-Release-Notes#removed-apis',
        title: 'Spring 6.0 migration guide',
      },
    ],
  },
  {
    id: 9,
    analysis: 1,
    ruleset: 'spring-framework',
    rule: 'spring-framework-5.x-to-6.0-data-access-00010',
    name: '',
    description: 'Spring 6 must use at least Hibernate Validator 7.0.x',
    category: 'optional',
    effort: 3,
    links: [
      {
        url: 'https://hibernate.org/validator/documentation/migration-guide/',
        title: 'Hibernate Validator migration guide',
      },
      {
        url: 'https://in.relation.to/2020/12/08/hibernate-validator-700-62-cr1-released/',
        title: 'Hibernate Validator 7.0 release and changelog details',
      },
      {
        url: 'https://github.com/spring-projects/spring-framework/wiki/Spring-Framework-6.0-Release-Notes#removed-apis',
        title: 'Spring 6.0 migration guide',
      },
    ],
  },
  {
    id: 2,
    analysis: 1,
    ruleset: 'discovery-rules',
    rule: 'discover-maven-xml',
    name: '',
    description: 'Maven XML file',
    category: 'information',
  },
  {
    id: 3,
    analysis: 1,
    ruleset: 'discovery-rules',
    rule: 'discover-properties-file',
    name: '',
    description: 'Properties file',
    category: 'information',
  },
  {
    id: 10,
    analysis: 1,
    ruleset: 'spring-framework',
    rule: 'spring-framework-5.x-to-6.0-web-applications-00010',
    name: '',
    description: '@RequestMapping does not detect controllers anymore',
    category: 'mandatory',
    effort: 1,
    links: [
      {
        url: 'https://github.com/spring-projects/spring-framework/wiki/Spring-Framework-6.0-Release-Notes#web-applications',
        title: 'Spring 6.0 migration guide',
      },
    ],
  },
  {
    id: 11,
    analysis: 1,
    ruleset: 'technology-usage',
    rule: 'database-03000',
    name: '',
    description: 'Embedded Spring Data JPA',
    category: 'potential',
  },
  {
    id: 15,
    analysis: 1,
    ruleset: 'technology-usage',
    rule: 'javaee-technology-usage-00120',
    name: '',
    description: 'Java Servlet',
    category: 'optional',
  },
  {
    id: 12,
    analysis: 1,
    ruleset: 'technology-usage',
    rule: 'embedded-framework-08200',
    name: '',
    description: 'Embedded framework - Spring DI',
    category: 'information',
  },
];

/** Incidents keyed by insight ID, as Hub returns them. */
export const hubIncidents: Record<number, KonveyorIncident[]> = {
  '4': [
    {
      id: 13,
      insight: 4,
      file: '/shared/source/example-applications/example-1/pom.xml',
      line: 107,
      message:
        'Replace dependency groupId `javax.activation` with `jakarta.activation`',
      codeSnip:
        ' 98  <version>2.5.0</version>\n 99  </dependency>\n100  <dependency>\n101  <groupId>org.apache.tomcat</groupId>\n102  <artifactId>tomcat-jdbc</artifactId>\n103  <version>${tomcat.version}</version>',
    },
  ],
  '5': [
    {
      id: 14,
      insight: 5,
      file: '/shared/source/example-applications/example-1/src/main/java/io/konveyor/demo/ordermanagement/OrderManagementAppInitializer.java',
      line: 5,
      message:
        'Replace the `javax.servlet` import statement with `jakarta.servlet`',
      codeSnip:
        ' 1  package io.konveyor.demo.ordermanagement;\n 2  \n 3  import javax.servlet.ServletContext;\n 4  import javax.servlet.ServletException;\n 5  import javax.servlet.ServletRegistration;\n 6  ',
    },
  ],
  '6': [
    {
      id: 24,
      insight: 6,
      file: '/shared/source/example-applications/example-1/pom.xml',
      line: 14,
      message:
        'Spring Framework 6.0 and above must use at least Java 17. Check the migration guide in the link for more information.',
      codeSnip:
        '15  \t\t<project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>',
    },
  ],
  '8': [
    {
      id: 26,
      insight: 8,
      file: '/shared/source/example-applications/example-1/pom.xml',
      line: 107,
      message:
        'Due to the Jakarta EE migration, Spring 6 must use at least Hibernate 5.6.x. To make Hibernate 5.6.x compatible with\nJakarta, make sure to also switch your hibernate dependency to the `hibernate-core-jakarta` artifact:\n```\n<dependency>\n    <groupId>org.hibernate.orm</groupId>\n    <artifactId>hibernate-core-jakarta</artifactId>\n    <version>5.6.15.Final</version>\n</dependency>\n```\nAlternatively, consider migrating to Hibernate ORM 6.1 right away (exclusively based on `jakarta.persistence`,\ncompatible with EE 9 as well as EE 10) which is the Hibernate version that Spring Boot 3.0 comes with.\n\nPlease check the Hibernate 5.6 migration guide in the links provided.',
      codeSnip:
        ' 98  <version>2.5.0</version>\n 99  </dependency>\n100  <dependency>\n101  <groupId>org.apache.tomcat</groupId>\n102  <artifactId>tomcat-jdbc</artifactId>\n103  <version>${tomcat.version}</version>',
    },
  ],
  '2': [
    {
      id: 11,
      insight: 2,
      file: '/shared/source/example-applications/example-1/pom.xml',
      line: 0,
      message: '',
    },
  ],
  '3': [
    {
      id: 12,
      insight: 3,
      file: '/shared/source/example-applications/example-1/src/main/resources/persistence.properties',
      line: 0,
      message: '',
    },
  ],
  '10': [
    {
      id: 28,
      insight: 10,
      file: '/shared/source/example-applications/example-1/src/main/java/io/konveyor/demo/ordermanagement/controller/CustomerController.java',
      line: 17,
      message:
        'Spring MVC and Spring WebFlux no longer detect controllers based solely on a type-level @RequestMapping\nannotation. That means interface-based AOP proxying for web controllers may no longer work. Please, enable\nclass-based proxying for such controllers; otherwise the interface must also be annotated with @Controller.',
      codeSnip:
        ' 7  import org.springframework.beans.factory.annotation.Autowired;\n 8  import org.springframework.data.domain.Page;\n 9  import org.springframework.data.domain.Pageable;\n10  import org.springframework.http.MediaType;\n11  import org.springframework.web.bind.annotation.GetMapping;\n12  import org.springframework.web.bind.annotation.PathVariable;',
    },
  ],
  '11': [
    {
      id: 30,
      insight: 11,
      file: '/shared/source/example-applications/example-1/pom.xml',
      line: 76,
      message: '',
      codeSnip:
        '67  <dependency>\n68  <groupId>com.fasterxml.jackson.core</groupId>\n69  <artifactId>jackson-core</artifactId>\n70  </dependency>\n71  <dependency>\n72  <groupId>com.fasterxml.jackson.core</groupId>',
    },
  ],
  '12': [
    {
      id: 31,
      insight: 12,
      file: '/shared/source/example-applications/example-1/pom.xml',
      line: 76,
      message: '',
      codeSnip:
        '67  <dependency>\n68  <groupId>com.fasterxml.jackson.core</groupId>\n69  <artifactId>jackson-core</artifactId>\n70  </dependency>\n71  <dependency>\n72  <groupId>com.fasterxml.jackson.core</groupId>',
    },
  ],
};
