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

// Minimal ZIP writer (stored entries, no compression) so the plugin can
// package rendered files client-side without adding a dependency.

export interface ZipEntry {
  path: string;
  content: string;
}

const ZIP32_MAX_ENTRIES = 65535;
const ZIP32_MAX_NAME_BYTES = 65535;
// ZIP32 stores sizes and offsets in 32 bit fields. Stay below the largest value
// rather than wrapping, which would produce an archive readers cannot open.
const ZIP32_MAX_ARCHIVE_BYTES = 4 * 1024 ** 3 - 1;
const LOCAL_HEADER_BYTES = 30;
const CENTRAL_HEADER_BYTES = 46;
const END_RECORD_BYTES = 22;
const DRIVE_LETTER = /^[A-Za-z]:/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

/** Shorten a path for an error message so a long name cannot flood the dialog. */
function displayPath(path: string): string {
  const limit = 120;
  return path.length > limit ? `${path.slice(0, limit)}...` : path;
}

/**
 * Check one archive member name. ZIP readers resolve names against the
 * extraction directory, so relative forward-slash paths are the only safe
 * shape for a downloaded archive.
 */
export function validateZipEntryName(path: string): string | undefined {
  const shown = displayPath(path);
  if (!path) return 'The archive contains a file without a name.';
  if (path.startsWith('/')) {
    return `The file "${shown}" has a leading slash. ZIP file names must be relative.`;
  }
  if (path.includes('\\')) {
    return `The file "${shown}" contains a backslash. ZIP file names must use forward slashes.`;
  }
  if (DRIVE_LETTER.test(path)) {
    return `The file "${shown}" starts with a drive letter. ZIP file names must be relative.`;
  }
  if (CONTROL_CHARACTERS.test(path)) {
    return `The file "${shown}" contains a control character.`;
  }
  if (
    path.split('/').some(part => part === '' || part === '.' || part === '..')
  ) {
    return `The file "${shown}" contains an unsafe path segment.`;
  }
  return undefined;
}

/**
 * ZIP32 limits. Sizes and offsets are 32 bit fields, so one file or the whole
 * archive must stay below 4 GiB minus one byte. Exported so the limit can be
 * unit tested without allocating a multi-gigabyte entry.
 */
export function validateZipByteSizes(
  nameBytes: readonly number[],
  dataBytes: readonly number[],
): string | undefined {
  if (nameBytes.length !== dataBytes.length) {
    throw new Error('ZIP entry name and data sizes must line up');
  }
  let total = END_RECORD_BYTES;
  for (let index = 0; index < dataBytes.length; index++) {
    if (dataBytes[index] >= ZIP32_MAX_ARCHIVE_BYTES) {
      return 'A file in the archive is too large for a ZIP archive. The limit is 4 GiB.';
    }
    total +=
      LOCAL_HEADER_BYTES +
      nameBytes[index] +
      dataBytes[index] +
      CENTRAL_HEADER_BYTES +
      nameBytes[index];
    if (total >= ZIP32_MAX_ARCHIVE_BYTES) {
      return 'The archive is too large for a ZIP archive. The limit is 4 GiB.';
    }
  }
  return undefined;
}

/**
 * Validate archive members before writing. Returns a member-facing error, or
 * undefined when every entry can be written as a safe ZIP32 member.
 */
export function validateZipEntries(entries: ZipEntry[]): string | undefined {
  if (entries.length > ZIP32_MAX_ENTRIES) {
    return `The archive contains ${entries.length.toLocaleString(
      'en-US',
    )} files. A ZIP archive can hold at most 65,535 files.`;
  }
  const encoder = new TextEncoder();
  const seen = new Set<string>();
  const nameBytes: number[] = [];
  const dataBytes: number[] = [];
  for (const entry of entries) {
    const problem = validateZipEntryName(entry.path);
    if (problem) return problem;
    if (seen.has(entry.path)) {
      return `The archive contains more than one file named "${displayPath(
        entry.path,
      )}".`;
    }
    seen.add(entry.path);
    const name = encoder.encode(entry.path);
    if (name.length > ZIP32_MAX_NAME_BYTES) {
      return `The file name "${displayPath(
        entry.path,
      )}" is too long for a ZIP archive.`;
    }
    nameBytes.push(name.length);
    dataBytes.push(encoder.encode(entry.content).length);
  }
  return validateZipByteSizes(nameBytes, dataBytes);
}

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

function dosDateTime(date: Date): { time: number; day: number } {
  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      (date.getSeconds() >> 1),
    day:
      ((date.getFullYear() - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}

const UTF8_FLAG = 0x0800;

export function createZipArchive(entries: ZipEntry[], date = new Date()): Blob {
  const problem = validateZipEntries(entries);
  if (problem) throw new Error(problem);
  const encoder = new TextEncoder();
  const { time, day } = dosDateTime(date);
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.path);
    const data = encoder.encode(entry.content);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, UTF8_FLAG, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, time, true);
    local.setUint16(12, day, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, data);

    const header = new DataView(new ArrayBuffer(46));
    header.setUint32(0, 0x02014b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 20, true);
    header.setUint16(8, UTF8_FLAG, true);
    header.setUint16(10, 0, true);
    header.setUint16(12, time, true);
    header.setUint16(14, day, true);
    header.setUint32(16, crc, true);
    header.setUint32(20, data.length, true);
    header.setUint32(24, data.length, true);
    header.setUint16(28, name.length, true);
    header.setUint32(42, offset, true);
    central.push(new Uint8Array(header.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  // Every part is backed by a plain ArrayBuffer; the cast satisfies newer DOM lib typings.
  return new Blob(
    [...parts, ...central, new Uint8Array(end.buffer)] as BlobPart[],
    {
      type: 'application/zip',
    },
  );
}
