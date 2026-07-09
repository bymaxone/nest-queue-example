/**
 * @fileoverview Application entry point. Boots the NestJS app, applies CORS from
 * the validated environment, enables graceful-shutdown hooks so the queue
 * library can drain workers on SIGTERM/SIGINT, and starts the HTTP listener.
 * @layer app/bootstrap
 */
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module.js'
import { APP_ENV, type AppEnv } from './config/env.js'

/**
 * Create the Nest application, wire runtime concerns from the parsed
 * environment, and listen. Shutdown hooks let the queue library run its ordered
 * drain when the process receives a termination signal.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)
  const env = app.get<AppEnv>(APP_ENV)
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true })
  app.enableShutdownHooks()
  await app.listen(env.PORT)
}

void bootstrap()
