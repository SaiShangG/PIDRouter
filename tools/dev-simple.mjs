import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const args = process.argv.slice(2)
const forwarded = []
let login = 'true'
let loginSpecified = false

for (let index = 0; index < args.length; index++) {
  const arg = args[index]
  if (arg === '--') continue
  if (arg === '--login' || arg.startsWith('--login=')) {
    const value = arg === '--login' ? args[++index] : arg.slice('--login='.length)
    if (loginSpecified || (value !== 'true' && value !== 'false')) {
      console.error('Use --login=true or --login=false, at most once.')
      process.exit(1)
    }
    login = value
    loginSpecified = true
  } else {
    forwarded.push(arg)
  }
}

const require = createRequire(import.meta.url)
const child = spawn(process.execPath, [
  require.resolve('nx/bin/nx.js'),
  'run',
  '@mlightcad/cad-simple-viewer-example:dev',
  ...forwarded
], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, PID_LOGIN_ENABLED: login },
  stdio: 'inherit'
})

child.on('error', error => {
  console.error('Failed to start the development server:', error)
  process.exitCode = 1
})
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0)
})
