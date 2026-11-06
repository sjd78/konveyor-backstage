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
import { render, screen } from '@testing-library/react';
import { themes, UnifiedThemeProvider } from '@backstage/theme';
import { usePersonaRole } from '../hooks/usePersonaRole';
import { MtaPersonaCard } from './MtaPersonaCard';

jest.mock('../hooks/usePersonaRole');
const mockUsePersonaRole = usePersonaRole as jest.MockedFunction<
  typeof usePersonaRole
>;

function renderCard() {
  return render(
    <UnifiedThemeProvider theme={themes.light}>
      <MtaPersonaCard />
    </UnifiedThemeProvider>,
  );
}

describe('MtaPersonaCard', () => {
  it('describes the architect persona, its group, and both destinations', () => {
    mockUsePersonaRole.mockReturnValue({ role: 'architect', loading: false });
    renderCard();

    expect(
      screen.getByRole('heading', { name: 'MTA Persona' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Active Persona:')).toBeInTheDocument();
    expect(screen.getByText('Architect')).toBeInTheDocument();
    expect(
      screen.getByText('group:default/mta-architects'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'As an MTA Architect, you have full access to discover applications, define target profiles, run repository analysis, and select migration paths for the team.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Migration Dashboard' }),
    ).toHaveAttribute('href', '/mta');
    expect(
      screen.getByRole('link', { name: 'Software Catalog' }),
    ).toHaveAttribute('href', '/catalog?filters%5Bkind%5D=component');
  });

  it('describes the developer persona and its group', () => {
    mockUsePersonaRole.mockReturnValue({ role: 'developer', loading: false });
    renderCard();

    expect(screen.getByText('Developer')).toBeInTheDocument();
    expect(
      screen.getByText('group:default/mta-developers'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'As an MTA Developer, you have focused access to assigned applications, code-level migration issues, AI-assisted remediation, and DevSpaces cloud environments.',
      ),
    ).toBeInTheDocument();
  });

  it('names an unassigned persona without a group', () => {
    mockUsePersonaRole.mockReturnValue({ role: 'unknown', loading: false });
    renderCard();

    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText('No group')).toBeInTheDocument();
    expect(
      screen.getByText(
        'This user is not currently mapped to an MTA persona group. Switch user using the log out button in the navigation bar to test Architect or Developer perspectives.',
      ),
    ).toBeInTheDocument();
  });

  it('shows a loading role until the identity resolves', () => {
    mockUsePersonaRole.mockReturnValue({ role: 'unknown', loading: true });
    renderCard();

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Unassigned')).not.toBeInTheDocument();
  });
});
