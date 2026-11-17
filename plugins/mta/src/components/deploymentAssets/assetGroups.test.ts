import {
  groupAssets,
  OTHER_FILES_GROUP_ID,
  OTHER_FILES_GROUP_NAME,
} from './assetGroups';
import type { AssetGenerator, RenderedAsset } from '../../api/deploymentAssets';

const generators: AssetGenerator[] = [
  { id: 'container', name: 'Container Build' },
  { id: 'deployment', name: 'OpenShift Deployment' },
  { id: 'unused', name: 'Unused Generator' },
];

const asset = (path: string, generatorId: string): RenderedAsset => ({
  path,
  generatorId,
  content: `${path}\n`,
});

describe('groupAssets', () => {
  it('keeps generator order and drops generators without files', () => {
    const groups = groupAssets(generators, [
      asset('Containerfile', 'container'),
      asset('k8s/base/deployment.yaml', 'deployment'),
      asset('k8s/base/service.yaml', 'deployment'),
    ]);

    expect(groups.map(group => group.generator.id)).toEqual([
      'container',
      'deployment',
    ]);
    expect(groups.map(group => group.assets.map(file => file.path))).toEqual([
      ['Containerfile'],
      ['k8s/base/deployment.yaml', 'k8s/base/service.yaml'],
    ]);
  });

  it('keeps files whose generator is missing in a final Other files group', () => {
    const unknown = [
      asset('orphan/config.yaml', 'retired-generator'),
      asset('orphan/notes.txt', 'another-missing-generator'),
    ];
    const groups = groupAssets(generators, [
      asset('Containerfile', 'container'),
      ...unknown,
      asset('k8s/base/deployment.yaml', 'deployment'),
    ]);

    expect(groups.map(group => group.generator.id)).toEqual([
      'container',
      'deployment',
      OTHER_FILES_GROUP_ID,
    ]);
    const other = groups.at(-1);
    expect(other?.generator.name).toBe(OTHER_FILES_GROUP_NAME);
    expect(other?.assets).toEqual(unknown);
  });

  it('adds no Other files group when every generator is known', () => {
    const groups = groupAssets(generators, [
      asset('Containerfile', 'container'),
    ]);
    expect(groups.map(group => group.generator.id)).toEqual(['container']);
  });

  it('returns no groups for no files', () => {
    expect(groupAssets(generators, [])).toEqual([]);
  });
});
