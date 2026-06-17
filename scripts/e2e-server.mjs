import { spawn } from 'node:child_process'
import { resetDatabase } from './db-reset.mjs'

await resetDatabase()

const devServer = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  env: process.env,
})

function stopDevServer(signal) {
  devServer.kill(signal)
}

process.on('SIGINT', stopDevServer)
process.on('SIGTERM', stopDevServer)

devServer.on('exit', (code) => {
  process.exit(code ?? 0)
})
