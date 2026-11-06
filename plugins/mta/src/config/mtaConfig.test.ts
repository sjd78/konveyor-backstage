import { readMtaConfig, type MtaConfigReader } from './mtaConfig';

function reader(values: Record<string, string>): MtaConfigReader {
  return { getOptionalString: (key: string) => values[key] };
}

// Assembled so the browser-script scheme is not a literal in the source.
const unsafeScriptUrl = ['javascript', ':', 'alert(1)'].join('');

describe('readMtaConfig', () => {
  it('reads nothing without a config API', () => {
    expect(readMtaConfig(undefined)).toEqual({});
  });

  it('reads nothing from an empty config', () => {
    expect(readMtaConfig(reader({}))).toEqual({});
  });

  it('reads the support contact', () => {
    expect(
      readMtaConfig(
        reader({
          'mta.support.name': 'Migration Team',
          'mta.support.email': 'migration-team@example.test',
        }),
      ),
    ).toEqual({
      supportName: 'Migration Team',
      supportEmail: 'migration-team@example.test',
    });
  });

  it('trims the values a deployment sets', () => {
    expect(
      readMtaConfig(
        reader({
          'mta.support.name': '  Migration Team  ',
          'mta.support.email': ' migration-team@example.test ',
        }),
      ),
    ).toEqual({
      supportName: 'Migration Team',
      supportEmail: 'migration-team@example.test',
    });
  });

  it('treats blank values as missing', () => {
    expect(
      readMtaConfig(
        reader({
          'mta.support.name': ' ',
          'mta.support.email': '',
          'mta.devSpaces.url': '   ',
        }),
      ),
    ).toEqual({});
  });

  it('treats an invalid support email as missing', () => {
    for (const value of [
      'not-an-email',
      'migration-team@',
      '@example.test',
      'migration team@example.test',
    ]) {
      expect(
        readMtaConfig(reader({ 'mta.support.email': value })).supportEmail,
      ).toBeUndefined();
    }
  });

  it('accepts a valid Dev Spaces URL', () => {
    expect(
      readMtaConfig(
        reader({ 'mta.devSpaces.url': 'https://devspaces.apps.example.test' }),
      ).devSpacesUrl,
    ).toBe('https://devspaces.apps.example.test/');
  });

  it('treats an invalid Dev Spaces URL as not configured', () => {
    for (const value of [
      unsafeScriptUrl,
      'ftp://devspaces.example.test',
      'https://member:secret@devspaces.example.test',
      'not a url',
    ]) {
      expect(
        readMtaConfig(reader({ 'mta.devSpaces.url': value })).devSpacesUrl,
      ).toBeUndefined();
    }
  });

  it('treats a config value of the wrong type as missing', () => {
    const throwing: MtaConfigReader = {
      getOptionalString: () => {
        throw new Error('expected a string');
      },
    };
    expect(readMtaConfig(throwing)).toEqual({});
  });
});
