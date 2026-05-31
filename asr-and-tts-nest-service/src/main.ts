import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as WebSocket from 'ws';
import { TtsRelayService } from './speech/tts-relay.service';
import { createServer } from 'net';

function findAvailablePort(startPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(startPort, () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
    server.on('error', () => {
      if (startPort < 65535) {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(new Error('No available port found'));
      }
    });
  });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const ttsRelayService = app.get(TtsRelayService);
  const server = app.getHttpServer();

  const ttsWss = new WebSocket.WebSocketServer({
    server,
    path: '/speech/tts/ws',
  });

  ttsWss.on('connection', (socket, request) => {
    const reqUrl = new URL(request.url ?? '', 'http://localhost');
    const wantedSessionId = reqUrl.searchParams.get('sessionId') ?? undefined;
    const sessionId = ttsRelayService.registerClient(socket, wantedSessionId);

    socket.on('close', () => {
      ttsRelayService.unregisterClient(sessionId);
    });
  });

  const desiredPort = Number(process.env.PORT) || 3000;
  const port = await findAvailablePort(desiredPort);
  await app.listen(port);
  if (port !== desiredPort) {
    console.log(`Port ${desiredPort} is in use, switched to port ${port}`);
  }
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
