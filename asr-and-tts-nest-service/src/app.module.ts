import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AiModule } from './ai/ai.module';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { SpeechModule } from './speech/speech.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { EventEmitterModule } from '@nestjs/event-emitter';

console.log(__dirname, '__dirname')

@Module({
  imports: [
    AiModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, '..', '..', '.env'),
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      // renderPath: '/public',
    }),
    EventEmitterModule.forRoot({
      maxListeners: 200
    }),
    SpeechModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
