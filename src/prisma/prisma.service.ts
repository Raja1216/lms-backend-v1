// src/prisma/prisma.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connLimit = Number(process.env.PRISMA_CONN_LIMIT ?? 20);
    const acquireTimeout = Number(process.env.PRISMA_ACQUIRE_TIMEOUT ?? 30000); // ms
    const waitForConnections =
      process.env.PRISMA_WAIT_FOR_CONNECTIONS !== 'false';

    const host = process.env.DB_HOST ?? '127.0.0.1';
    const port = Number(process.env.DB_PORT ?? 3306);
    const user = process.env.DB_USER ?? 'root';
    const password = process.env.DB_PASS ?? undefined; // undefined if none
    const database = process.env.DB_NAME ?? 'lms_db';

    console.log(
      `[PrismaService] adapter config host=${host} port=${port} user=${user} database=${database} poolLimit=${connLimit} acquireTimeout=${acquireTimeout}`,
    );

    const adapter = new PrismaMariaDb({
      host,
      port,
      user,
      password,
      database,
      connectionLimit: connLimit,
      acquireTimeout,
      waitForConnections,
    } as unknown as any);

    super({
      adapter,
      log: ['query', 'info', 'warn', 'error'],
    } as any);
  }

  // connect with retry/backoff so service fails early during startup if DB unreachable
  async onModuleInit() {
    const maxRetries = Number(process.env.PRISMA_CONNECT_RETRIES ?? 5);
    let attempt = 0;
    while (true) {
      try {
        attempt++;
        console.log(
          `[PrismaService] $connect attempt ${attempt} (pid=${process.pid})`,
        );
        await this.$connect();
        console.log('[PrismaService] connected');
        break;
      } catch (err) {
        console.error(
          `[PrismaService] connect failed attempt ${attempt}`,
          err?.message ?? err,
        );
        if (attempt >= maxRetries) {
          console.error(
            '[PrismaService] exceeded max connect retries, rethrowing',
          );
          throw err;
        }
        // backoff
        const backoffMs = 2000 * attempt;
        await new Promise((r) => setTimeout(r, backoffMs));
      }
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
      console.log('[PrismaService] disconnected');
    } catch (err) {
      console.error('[PrismaService] error during disconnect', err);
    }
  }
}
