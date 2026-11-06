import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import {
  NETWORK_DEFAULTS,
  readHttpUrl,
  readPort,
  readPositiveInteger,
  readProxySetting
} from '../src/networkConfig'

describe('network configuration', () => {
  it('uses only .env.example for development and production addresses', () => {
    execFileSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { readFileSync } from 'node:fs';
      import { parseEnv } from 'node:util';
      import { resolveConfig } from 'vite';
      const root = 'packages/cad-simple-viewer-example';
      const expected = parseEnv(readFileSync(root + '/.env.example', 'utf8'));
      for (const command of ['serve', 'build']) {
        const config = await resolveConfig({ root, configFile: root + '/vite.config.ts' }, command);
        assert.equal(config.envFile, false);
        assert.deepEqual(config.envPrefix, []);
        assert.equal(config.server.host, expected.PID_FRONTEND_HOST.trim());
        assert.equal(config.preview.host, expected.PID_FRONTEND_HOST.trim());
        const target = new URL(expected.VITE_PROCESS_ASSISTANT_API_URL.trim()).href.replace(/\\/$/, '');
        assert.equal(config.server.proxy['/api'].target, target);
        assert.equal(config.server.proxy['/uploads'].target, target);
        assert.equal(JSON.parse(config.define['import.meta.env.VITE_PROCESS_ASSISTANT_API_URL']), target);
        assert.equal(config.env.VITE_PROCESS_ASSISTANT_API_URL, undefined);
      }
      assert.ok(!readFileSync(root + '/src/api/processAssistantConfig.ts', 'utf8').includes('PID_VIEWER_CONFIG'));
    `], {
      cwd: resolve(__dirname, '../../..'),
      env: {
        ...process.env,
        PID_FRONTEND_HOST: 'override.invalid',
        VITE_PROCESS_ASSISTANT_API_URL: 'http://override.invalid:9999'
      }
    })
  }, 30000)

  it('accepts an explicitly configured HTTP endpoint', () => {
    expect(readHttpUrl(' https://api.example.test:5153/ ', 'API_URL')).toBe(
      'https://api.example.test:5153'
    )
  })

  it.each([
    undefined,
    '',
    '   ',
    'localhost:5153',
    'ftp://example.test',
    'http://example.test:0',
    'http://example.test/?x=1'
  ])('rejects invalid backend URL %s', value => {
    expect(() => readHttpUrl(value, 'API_URL')).toThrow('API_URL')
  })

  it('validates configured server ports', () => {
    expect(readPort(undefined, 'PORT', NETWORK_DEFAULTS.frontendPort)).toBe(
      5173
    )
    expect(readPort(' 5180 ', 'PORT', NETWORK_DEFAULTS.frontendPort)).toBe(5180)
    for (const value of ['0', '65536', '1.5', 'abc']) {
      expect(() => readPort(value, 'PORT', 5173)).toThrow('PORT')
    }
  })

  it('validates project IDs and proxy settings', () => {
    expect(readPositiveInteger(undefined, 'PROJECT_ID', 1)).toBe(1)
    expect(readPositiveInteger('42', 'PROJECT_ID', 1)).toBe(42)
    expect(() => readPositiveInteger('0', 'PROJECT_ID', 1)).toThrow(
      'PROJECT_ID'
    )
    expect(readProxySetting(undefined)).toBe(true)
    expect(readProxySetting(' false ')).toBe(false)
    expect(() => readProxySetting('yes')).toThrow(
      'VITE_PROCESS_ASSISTANT_USE_PROXY'
    )
  })
})
