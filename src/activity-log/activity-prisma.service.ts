import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../generated/logging-client/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class ActivityPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const connLimit = Number(process.env.PRISMA_CONN_LIMIT ?? 20);
    const acquireTimeout = Number(process.env.PRISMA_ACQUIRE_TIMEOUT ?? 30000); // ms
    const waitForConnections =
      process.env.PRISMA_WAIT_FOR_CONNECTIONS !== 'false';

    const host = process.env.DB_HOST ?? '127.0.0.1';
    const port = Number(process.env.DB_PORT ?? 3306);
    const user = process.env.DB_USER ?? 'root';
    const password = process.env.DB_PASS ?? undefined; // undefined if none
    const database = process.env.ACTIVITY_DB_NAME;

    console.log(
      `[ActivityPrismaService] adapter config host=${host} port=${port} user=${user} database=${database} poolLimit=${connLimit} acquireTimeout=${acquireTimeout}`,
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
      log: ['info', 'warn', 'error'],
    } as any);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
