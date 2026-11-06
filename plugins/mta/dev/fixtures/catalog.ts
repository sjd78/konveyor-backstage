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
import type { Entity } from '@backstage/catalog-model';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import { catalogApiMock } from '@backstage/plugin-catalog-react/testUtils';
import { PERSONA_USER_REFS } from './identity';

/** The catalog API type, taken from the catalog API ref. */
export type CatalogApi = (typeof catalogApiRef)['T'];

/** An in-memory catalog that answers the filters `useMtaHomeData` sends. */
export function createCatalog(entities: Entity[]): CatalogApi {
  return catalogApiMock({ entities });
}

/**
 * A catalog whose entity request fails, for the home error state. Only
 * `getEntities` is exercised by the home card.
 */
export function createFailingCatalog(message: string): CatalogApi {
  return {
    getEntities: async () => {
      throw new Error(message);
    },
  } as unknown as CatalogApi;
}

function component(
  name: string,
  options: {
    title?: string;
    applicationId?: string | number;
    architectOwned?: boolean;
    assignedDeveloper?: string;
  } = {},
): Entity {
  const annotations: Record<string, string> = {};
  if (options.applicationId !== undefined) {
    annotations['konveyor.io/application-id'] = String(options.applicationId);
  }
  if (options.assignedDeveloper) {
    annotations['mta.konveyor.io/assigned-developer'] =
      options.assignedDeveloper;
  }
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Component',
    metadata: {
      name,
      title: options.title ?? name,
      namespace: 'default',
      annotations,
      tags: ['java', 'spring'],
    },
    spec: { type: 'service', lifecycle: 'production', owner: 'team-a' },
    relations: options.architectOwned
      ? [
          {
            type: 'ownedBy',
            targetRef: 'group:default/mta-architects',
          },
        ]
      : undefined,
  };
}

/** The entity the migration tab tile renders, connected or not. */
export function createMigrationEntity(annotation?: string): Entity {
  return component('inventory-service', {
    title: 'Inventory Service',
    applicationId: annotation,
    architectOwned: true,
  });
}

/** Catalog entities for the architect home rows, one per row status. */
export function createArchitectHomeEntities(): Entity[] {
  return [
    component('legacy-portal', {
      title: 'Legacy Portal',
      architectOwned: true,
    }),
    component('payments-service', {
      title: 'Payments Service',
      applicationId: 9999,
      architectOwned: true,
    }),
    component('checkout-service', {
      title: 'Checkout Service',
      applicationId: 203,
      architectOwned: true,
    }),
    component('orders-service', {
      title: 'Orders Service',
      applicationId: 204,
      architectOwned: true,
    }),
    component('catalog-service', {
      title: 'Catalog Service',
      applicationId: 205,
      architectOwned: true,
    }),
    component('cart-service', {
      title: 'Cart Service',
      applicationId: 206,
      architectOwned: true,
    }),
    component('shipping-service', {
      title: 'Shipping Service',
      applicationId: 207,
      architectOwned: true,
    }),
    component('billing-service', {
      title: 'Billing Service',
      applicationId: 208,
      architectOwned: true,
    }),
    component('notifications-service', {
      title: 'Notifications Service',
      applicationId: 209,
      architectOwned: true,
    }),
    component('gateway-service', {
      title: 'Gateway Service',
      applicationId: 210,
      architectOwned: true,
    }),
    component('identity-service', {
      title: 'Identity Service',
      applicationId: 211,
      architectOwned: true,
    }),
  ];
}

/** Catalog entities for the developer home rows, assigned to the persona. */
export function createDeveloperHomeEntities(): Entity[] {
  const assignedDeveloper = PERSONA_USER_REFS.developer;
  return [
    component('orders-service', {
      title: 'Orders Service',
      applicationId: 204,
      assignedDeveloper,
    }),
    component('billing-service', {
      title: 'Billing Service',
      applicationId: 208,
      assignedDeveloper,
    }),
  ];
}
