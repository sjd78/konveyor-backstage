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
  AssetGenerator,
  RenderedAsset,
} from '../../src/api/deploymentAssets';

/*
 * Development fixture for rendered deployment assets. No Hub renders these
 * files: the gallery uses them to show the file browser, and the archive unit
 * test uses them to prove a realistic download keeps its bytes. A host that
 * registers a deployment asset implementation supplies the real files.
 *
 * The shape stands in for MTA 8.3 generator output (GitOps, pipelines,
 * services). Generator descriptions are optional and render only when present.
 */

// Maven flags in the Containerfile split into tokens no dictionary can know.
// cspell:ignore Dskip Dquarkus

export const ASSET_FIXTURE_GENERATORS: AssetGenerator[] = [
  {
    id: 'container',
    name: 'Container Build',
    description:
      'Multi-stage build on approved UBI 9 OpenJDK 21 images, running as a non-root user.',
  },
  {
    id: 'deployment',
    name: 'OpenShift Deployment',
    description:
      'Two replicas minimum, health probes on Quarkus endpoints, CPU-based autoscaling, and memory limits required by the platform team.',
  },
  {
    id: 'service',
    name: 'Service',
    description:
      'Exposes the app inside the cluster and through an edge-terminated TLS route. Plain HTTP redirects to HTTPS.',
  },
  {
    id: 'gitops',
    name: 'GitOps',
    description:
      'Kustomize base with dev and prod overlays. Argo CD syncs dev automatically; prod sync needs manual approval.',
  },
  {
    id: 'pipelines',
    name: 'Pipelines',
    description:
      'Pipelines as Code: build with Buildah, scan with acme-image-scan, and run on pull requests and pushes to main.',
  },
];

/** Files for one application, as a Hub generator would render them. */
export function renderAssetFixture(
  appName: string,
  repoUrl: string,
): RenderedAsset[] {
  const image = `quay.acme.com/apps/${appName}`;
  return [
    {
      path: 'Containerfile',
      generatorId: 'container',
      content: `# Build stage uses the corporate UBI builder
FROM registry.access.redhat.com/ubi9/openjdk-21:1.20 AS build
WORKDIR /build
COPY --chown=185 pom.xml .
RUN mvn -B dependency:go-offline
COPY --chown=185 src ./src
RUN mvn -B package -DskipTests -Dquarkus.package.jar.type=fast-jar

FROM registry.access.redhat.com/ubi9/openjdk-21-runtime:1.20
ENV LANGUAGE='en_US:en'
COPY --from=build --chown=185 /build/target/quarkus-app/lib/ /deployments/lib/
COPY --from=build --chown=185 /build/target/quarkus-app/*.jar /deployments/
COPY --from=build --chown=185 /build/target/quarkus-app/app/ /deployments/app/
COPY --from=build --chown=185 /build/target/quarkus-app/quarkus/ /deployments/quarkus/
EXPOSE 8080
USER 185
ENV JAVA_APP_JAR="/deployments/quarkus-run.jar"`,
    },
    {
      path: 'k8s/base/deployment.yaml',
      generatorId: 'deployment',
      content: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${appName}
  labels:
    app.kubernetes.io/name: ${appName}
spec:
  replicas: 2
  selector:
    matchLabels:
      app.kubernetes.io/name: ${appName}
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ${appName}
    spec:
      containers:
        - name: ${appName}
          image: ${image}:latest
          ports:
            - containerPort: 8080
              protocol: TCP
          envFrom:
            - configMapRef:
                name: ${appName}-config
          readinessProbe:
            httpGet:
              path: /q/health/ready
              port: 8080
          livenessProbe:
            httpGet:
              path: /q/health/live
              port: 8080
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              memory: 512Mi`,
    },
    {
      path: 'k8s/base/configmap.yaml',
      generatorId: 'deployment',
      content: `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${appName}-config
data:
  QUARKUS_DATASOURCE_DB_KIND: postgresql
  QUARKUS_HTTP_PORT: "8080"
  QUARKUS_LOG_CONSOLE_JSON: "true"`,
    },
    {
      path: 'k8s/base/hpa.yaml',
      generatorId: 'deployment',
      content: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${appName}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${appName}
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70`,
    },
    {
      path: 'k8s/base/service.yaml',
      generatorId: 'service',
      content: `apiVersion: v1
kind: Service
metadata:
  name: ${appName}
spec:
  selector:
    app.kubernetes.io/name: ${appName}
  ports:
    - name: http
      port: 8080
      targetPort: 8080`,
    },
    {
      path: 'k8s/base/route.yaml',
      generatorId: 'service',
      content: `apiVersion: route.openshift.io/v1
kind: Route
metadata:
  name: ${appName}
spec:
  to:
    kind: Service
    name: ${appName}
  port:
    targetPort: http
  tls:
    termination: edge
    insecureEdgeTerminationPolicy: Redirect`,
    },
    {
      path: 'k8s/base/kustomization.yaml',
      generatorId: 'gitops',
      content: `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - deployment.yaml
  - configmap.yaml
  - hpa.yaml
  - service.yaml
  - route.yaml`,
    },
    {
      path: 'k8s/overlays/dev/kustomization.yaml',
      generatorId: 'gitops',
      content: `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: ${appName}-dev
resources:
  - ../../base
patches:
  - target:
      kind: Deployment
      name: ${appName}
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 1`,
    },
    {
      path: 'k8s/overlays/prod/kustomization.yaml',
      generatorId: 'gitops',
      content: `apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: ${appName}-prod
resources:
  - ../../base
images:
  - name: ${image}
    newTag: stable`,
    },
    {
      path: 'argocd/application-dev.yaml',
      generatorId: 'gitops',
      content: `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ${appName}-dev
  namespace: openshift-gitops
spec:
  project: default
  source:
    repoURL: ${repoUrl}
    targetRevision: HEAD
    path: k8s/overlays/dev
  destination:
    server: https://kubernetes.default.svc
    namespace: ${appName}-dev
  syncPolicy:
    automated:
      prune: true
      selfHeal: true`,
    },
    {
      path: 'argocd/application-prod.yaml',
      generatorId: 'gitops',
      content: `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ${appName}-prod
  namespace: openshift-gitops
spec:
  project: default
  source:
    repoURL: ${repoUrl}
    targetRevision: HEAD
    path: k8s/overlays/prod
  destination:
    server: https://kubernetes.default.svc
    namespace: ${appName}-prod
  # Production sync requires manual approval (corporate policy)
  syncPolicy: {}`,
    },
    {
      path: '.tekton/pipeline.yaml',
      generatorId: 'pipelines',
      content: `apiVersion: tekton.dev/v1
kind: Pipeline
metadata:
  name: ${appName}-build
spec:
  params:
    - name: git-url
    - name: revision
      default: main
  workspaces:
    - name: source
  tasks:
    - name: clone
      taskRef:
        resolver: cluster
        params:
          - { name: name, value: git-clone }
      workspaces:
        - { name: output, workspace: source }
    - name: build-image
      runAfter: [clone]
      taskRef:
        resolver: cluster
        params:
          - { name: name, value: buildah }
      params:
        - name: IMAGE
          value: ${image}:$(params.revision)
    - name: scan
      runAfter: [build-image]
      taskRef:
        resolver: cluster
        params:
          - { name: name, value: acme-image-scan }`,
    },
    {
      path: '.tekton/pipelinerun-push.yaml',
      generatorId: 'pipelines',
      content: `apiVersion: tekton.dev/v1
kind: PipelineRun
metadata:
  generateName: ${appName}-push-
  annotations:
    pipelinesascode.tekton.dev/on-event: "[push]"
    pipelinesascode.tekton.dev/on-target-branch: "[main]"
spec:
  pipelineRef:
    name: ${appName}-build
  params:
    - name: git-url
      value: "{{ repo_url }}"
    - name: revision
      value: "{{ revision }}"`,
    },
    {
      path: '.tekton/pipelinerun-pr.yaml',
      generatorId: 'pipelines',
      content: `apiVersion: tekton.dev/v1
kind: PipelineRun
metadata:
  generateName: ${appName}-pr-
  annotations:
    pipelinesascode.tekton.dev/on-event: "[pull_request]"
    pipelinesascode.tekton.dev/on-target-branch: "[main]"
spec:
  pipelineRef:
    name: ${appName}-build
  params:
    - name: git-url
      value: "{{ repo_url }}"
    - name: revision
      value: "{{ revision }}"`,
    },
  ];
}

/**
 * Two files whose directory names are longer than their row, for the tile that
 * shows the full path on hover and focus. The short file name fits, so only
 * the directory clips.
 */
export const LONG_PATH_ASSETS: RenderedAsset[] = [
  {
    path: 'a-very-long-directory-name-for-a-migration-template/nested-module-with-a-long-name/config.yaml',
    generatorId: 'deployment',
    content: `apiVersion: v1
kind: ConfigMap
metadata:
  name: example-app-config
data:
  QUARKUS_HTTP_PORT: "8080"`,
  },
  {
    path: 'short/ok.yaml',
    generatorId: 'deployment',
    content: `apiVersion: v1
kind: ConfigMap
metadata:
  name: example-app-short
data:
  QUARKUS_HTTP_PORT: "8080"`,
  },
];
