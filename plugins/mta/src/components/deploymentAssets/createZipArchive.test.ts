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
import { createHash } from 'node:crypto';
import {
  createZipArchive,
  validateZipByteSizes,
  validateZipEntries,
  validateZipEntryName,
} from './createZipArchive';
// The gallery renders this fixture, so the archive test proves the bytes of the
// files a reviewer can see in the browser.
import { renderAssetFixture } from '../../../dev/fixtures/deploymentAssets';

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ParsedZipEntry {
  name: string;
  content: string;
  crc: number;
  flags: number;
  method: number;
}

/**
 * Read the central directory of an archive written by createZipArchive and
 * verify each local header, size and CRC. This checks the archive the way a
 * ZIP reader would rather than trusting the writer's own bookkeeping.
 */
async function parseZip(blob: Blob): Promise<ParsedZipEntry[]> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  let end = -1;
  for (let index = bytes.length - 22; index >= 0; index--) {
    if (view.getUint32(index, true) === EOCD_SIGNATURE) {
      end = index;
      break;
    }
  }
  expect(end).toBeGreaterThanOrEqual(0);
  const count = view.getUint16(end + 10, true);
  const centralSize = view.getUint32(end + 12, true);
  const centralOffset = view.getUint32(end + 16, true);
  expect(centralOffset + centralSize).toBe(end);

  const decoder = new TextDecoder();
  const entries: ParsedZipEntry[] = [];
  let cursor = centralOffset;
  for (let index = 0; index < count; index++) {
    expect(view.getUint32(cursor, true)).toBe(CENTRAL_SIGNATURE);
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const crc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = decoder.decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    );

    expect(view.getUint32(localOffset, true)).toBe(LOCAL_SIGNATURE);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.subarray(dataStart, dataStart + compressedSize);
    expect(compressedSize).toBe(size);
    expect(crc32(data)).toBe(crc);

    entries.push({ name, content: decoder.decode(data), crc, flags, method });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  expect(cursor).toBe(centralOffset + centralSize);
  expect(entries).toHaveLength(count);
  return entries;
}

describe('createZipArchive', () => {
  it('writes nested and Unicode names with valid headers, sizes and CRCs', async () => {
    const entries = [
      { path: 'docs/index.md', content: '# Deployment assets\n' },
      { path: 'docs/部署说明.md', content: '部署资产说明\n' },
      { path: 'k8s/base/deployment.yaml', content: 'apiVersion: apps/v1\n' },
      { path: '日本語/ファイル.txt', content: '設定ファイル\n' },
    ];
    const parsed = await parseZip(createZipArchive(entries));

    expect(parsed.map(entry => entry.name)).toEqual(
      entries.map(entry => entry.path),
    );
    expect(parsed.map(entry => entry.content)).toEqual(
      entries.map(entry => entry.content),
    );
    for (const entry of parsed) {
      expect(entry.method).toBe(0);
      expect(entry.flags & 0x0800).toBe(0x0800);
    }
  });

  it('keeps the 14-file deployment download byte for byte', async () => {
    const folder = 'example-app-deployment-assets';
    const assets = renderAssetFixture(
      'example-app',
      'https://github.com/konveyor/example-applications.git',
    );
    expect(assets).toHaveLength(14);
    const blob = createZipArchive(
      assets.map(asset => ({
        path: `${folder}/${asset.path}`,
        content: asset.content,
      })),
      // Local components, so the DOS date is the same in every timezone.
      new Date(2026, 0, 2, 3, 4, 6),
    );
    const bytes = Buffer.from(await blob.arrayBuffer());
    expect(bytes.length).toBe(8241);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      'f1db71e4ea25611c9dc6d5795dd7140c2b4ef5577490dab3040591468b879293',
    );
  });

  const unsafeNames: Array<[string, string]> = [
    ['a parent segment', '../outside.txt'],
    ['a nested parent segment', 'a/../outside.txt'],
    ['an absolute path', '/absolute.txt'],
    ['a Windows path', 'C:\\project\\file.txt'],
    ['a drive letter', 'C:/project/file.txt'],
    ['a backslash separator', 'a\\b.txt'],
    ['an empty segment', 'a//b.txt'],
    ['a current-directory segment', './a.txt'],
    ['a nested current-directory segment', 'a/./b.txt'],
    ['a control character', 'a\u0001b.txt'],
    ['an empty name', ''],
  ];

  it.each(unsafeNames)('rejects %s', (_description, path) => {
    expect(validateZipEntryName(path)).toBeTruthy();
    expect(validateZipEntries([{ path, content: 'x' }])).toBeTruthy();
    expect(() => createZipArchive([{ path, content: 'x' }])).toThrow(Error);
  });

  it('rejects duplicate names but allows names that differ in case', () => {
    expect(
      validateZipEntries([
        { path: 'k8s/base/app.yaml', content: 'a' },
        { path: 'k8s/base/app.yaml', content: 'b' },
      ]),
    ).toMatch(/more than one file/i);
    expect(() =>
      createZipArchive([
        { path: 'k8s/base/app.yaml', content: 'a' },
        { path: 'k8s/base/app.yaml', content: 'b' },
      ]),
    ).toThrow(/more than one file/i);

    expect(
      validateZipEntries([
        { path: 'README.md', content: 'a' },
        { path: 'readme.md', content: 'b' },
        { path: 'docs/README.md', content: 'c' },
      ]),
    ).toBeUndefined();
  });

  it('rejects more than 65,535 entries', () => {
    const entries = Array.from({ length: 65536 }, (_, index) => ({
      path: `files/${index}.txt`,
      content: '',
    }));
    expect(validateZipEntries(entries)).toMatch(/at most 65,535 files/i);
  });

  it('rejects an encoded name over 65,535 bytes', () => {
    expect(
      validateZipEntries([{ path: 'a'.repeat(65536), content: '' }]),
    ).toMatch(/too long/i);
  });

  it('rejects files and archives over the ZIP32 size limit', () => {
    const limit = 4 * 1024 ** 3 - 1;
    expect(validateZipByteSizes([16], [limit])).toMatch(/too large/i);
    expect(validateZipByteSizes([0, 0], [limit - 64, limit - 64])).toMatch(
      /archive is too large/i,
    );
    expect(validateZipByteSizes([16], [1024])).toBeUndefined();
  });

  it('accepts ordinary relative paths', () => {
    expect(
      validateZipEntries([
        { path: 'deployment-assets/Containerfile', content: 'FROM ubi9\n' },
        { path: 'deployment-assets/k8s/base/deployment.yaml', content: 'x' },
      ]),
    ).toBeUndefined();
  });
});
