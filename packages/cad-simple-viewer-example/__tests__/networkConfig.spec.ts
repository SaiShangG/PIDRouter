import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import {
  NETWORK_DEFAULTS,
  readHttpUrl,
  readPort,
  readPositiveInteger,
  readProxySetting,
  resolveHttpUrl
} from '../src/networkConfig'

describe('network configuration', () => {
  it('uses only .env.example for development and production addresses', () => {
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `
      import assert from 'node:assert/strict';
      import { readFileSync } from 'node:fs';
      import { resolve } from 'node:path';
      import { parseEnv } from 'node:util';
      import { runInNewContext } from 'node:vm';
      import { build, resolveConfig } from 'vite';
      const root = resolve('packages', 'cad-simple-viewer-example');
      const configFile = resolve(root, 'vite.config.ts');
      const expected = parseEnv(readFileSync(resolve(root, '.env.example'), 'utf8'));
      const configured = new URL(expected.VITE_PROCESS_ASSISTANT_API_URL.trim());
      const configuredUrl = configured.href.replace(/\\/$/, '');
      const proxy = new URL(configured);
      if (proxy.hostname === 'auto') proxy.hostname = '127.0.0.1';
      const target = proxy.href.replace(/\\/$/, '');
      for (const command of ['serve', 'build']) {
        const config = await resolveConfig({ root, configFile }, command);
        assert.equal(config.envFile, false);
        assert.deepEqual(config.envPrefix, []);
        assert.equal(config.server.host, expected.PID_FRONTEND_HOST.trim());
        assert.equal(config.preview.host, expected.PID_FRONTEND_HOST.trim());
        assert.equal(config.server.proxy['/api'].target, target);
        assert.equal(config.server.proxy['/uploads'].target, target);
        assert.equal(JSON.parse(config.define['import.meta.env.VITE_PROCESS_ASSISTANT_API_URL']), configuredUrl);
        assert.equal(config.env.VITE_PROCESS_ASSISTANT_API_URL, undefined);
      }
      const entry = resolve(root, 'src', 'api', 'processAssistantConfig.ts');
      assert.ok(!readFileSync(entry, 'utf8').includes('PID_VIEWER_CONFIG'));
      for (const [dev, useProxy] of [
        [false, expected.VITE_PROCESS_ASSISTANT_USE_PROXY],
        [true, expected.VITE_PROCESS_ASSISTANT_USE_PROXY],
        [true, 'false']
      ]) {
        const result = await build({
          root,
          configFile,
          logLevel: 'warn',
          define: {
            'import.meta.env.DEV': JSON.stringify(dev),
            'import.meta.env.VITE_PROCESS_ASSISTANT_USE_PROXY': JSON.stringify(useProxy)
          },
          build: {
            write: false,
            minify: false,
            lib: { entry, formats: ['cjs'] },
            rollupOptions: { input: entry, output: { format: 'cjs' } }
          }
        });
        const output = Array.isArray(result) ? result[0].output : result.output;
        const chunk = output.find(item => item.type === 'chunk' && item.isEntry);
        assert.ok(chunk, 'Browser configuration entry must be bundled');
        for (const hostname of ['localhost', '192.168.1.20', '10.0.0.30', '[::1]']) {
          const exports = {};
          runInNewContext(chunk.code, { exports, URL, window: { location: { hostname } } });
          const browserTarget = new URL(configured);
          if (browserTarget.hostname === 'auto') browserTarget.hostname = hostname;
          const browserUrl = browserTarget.href.replace(/\\/$/, '');
          assert.equal(exports.PROCESS_ASSISTANT_TARGET_URL, browserUrl);
          assert.equal(exports.PROCESS_ASSISTANT_API_URL, dev && useProxy !== 'false' ? '' : browserUrl);
          assert.equal(exports.getProcessAssistantConfig().baseUrl, exports.PROCESS_ASSISTANT_API_URL);
          assert.equal(exports.getProcessAssistantConfig().projectId, Number(expected.VITE_PROCESS_ASSISTANT_PROJECT_ID));
        }
      }
    `
      ],
      {
        cwd: resolve(__dirname, '../../..'),
        env: {
          ...process.env,
          PID_FRONTEND_HOST: 'override.invalid',
          VITE_PROCESS_ASSISTANT_API_URL: 'http://override.invalid:9999'
        }
      }
    )
  }, 60000)

  it('accepts an explicitly configured HTTP endpoint', () => {
    expect(readHttpUrl(' https://api.example.test:5153/ ', 'API_URL')).toBe(
      'https://api.example.test:5153'
    )
  })

  it.each([
    ['http://auto:5153', 'localhost', 'http://localhost:5153'],
    ['http://auto:5153', '127.0.0.1', 'http://127.0.0.1:5153'],
    ['http://auto:5153', '192.168.1.20', 'http://192.168.1.20:5153'],
    ['http://auto:5153', '10.0.0.30', 'http://10.0.0.30:5153'],
    ['http://auto:5153', '[::1]', 'http://[::1]:5153'],
    [
      'https://auto:5153/backend/',
      'viewer.example.test',
      'https://viewer.example.test:5153/backend'
    ],
    ['https://auto:443', 'viewer.example.test', 'https://viewer.example.test']
  ])('resolves %s using frontend hostname %s', (value, hostname, expected) => {
    expect(resolveHttpUrl(value, 'API_URL', hostname)).toBe(expected)
  })

  it.each(['https://api.example.test:5153/backend/', 'http://127.0.0.1:5153'])(
    'preserves the explicitly configured backend %s',
    value => {
      expect(resolveHttpUrl(value, 'API_URL', '192.168.1.20')).toBe(
        readHttpUrl(value, 'API_URL')
      )
    }
  )

  it('rejects automatic resolution without a frontend hostname', () => {
    expect(() =>
      resolveHttpUrl('http://auto:5153/backend', 'API_URL', '')
    ).toThrow('API_URL cannot resolve auto without a frontend hostname')
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
