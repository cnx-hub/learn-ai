import { Inject, Module, OnApplicationBootstrap } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { MailerModule } from '@nestjs-modules/mailer';
import { ServeStaticModule } from '@nestjs/serve-static';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Job } from './job/entities/job.entity';
import { User } from './users/entities/user.entity';
import {
  CronExpression,
  ScheduleModule,
  SchedulerRegistry,
} from '@nestjs/schedule';
import { CronJob } from 'cron';
import { JobModule } from './job/job.module';

@Module({
  imports: [
    AiModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '..', '.env'),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return {
          transport: {
            host: configService.get<string>('MAIL_HOST'),
            port: configService.get<string>('MAIL_PORT'),
            secure: configService.get<string>('MAIL_SECURE') === 'true',
            auth: {
              user: configService.get<string>('MAIL_USER'),
              pass: configService.get<string>('MAIL_PASS'),
            },
          },
          defaults: {
            from: configService.get<string>('MAIL_FROM'),
          },
        };
      },
    }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      username: 'root',
      password: 'admin',
      database: 'hello',
      synchronize: true,
      connectorPackage: 'mysql2',
      logging: true,
      entities: [User, Job],
    }),
    ScheduleModule.forRoot(),
    JobModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements OnApplicationBootstrap {
  @Inject(SchedulerRegistry)
  schedulerRegistry: SchedulerRegistry;

  onApplicationBootstrap() {
    // const job = new CronJob(CronExpression.EVERY_SECOND, () => {
    //   console.log('This job runs every second');
    // });
    // this.schedulerRegistry.addCronJob('job1', job);
    // job.start();
    // setTimeout(() => {
    //   this.schedulerRegistry.deleteCronJob('job1');
    // }, 5000);
    // const job2 = setInterval(() => {
    //   console.log('run interval job');
    // }, 1000);
    // this.schedulerRegistry.addInterval('job2', job2);
    // setTimeout(() => {
    //   this.schedulerRegistry.deleteInterval('job2');
    // }, 5000);
    // const job3 = setTimeout(() => {
    //   console.log('run timeout job');
    // }, 3000);
    // this.schedulerRegistry.addTimeout('timeout1', job3);
    // setTimeout(() => {
    //   this.schedulerRegistry.deleteTimeout('timeout1');
    // }, 5000);
  }
}
