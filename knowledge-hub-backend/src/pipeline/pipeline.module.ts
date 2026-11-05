import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DocumentContent,
  DocumentContentSchema,
} from '../document/schemas/document-content.schema';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './embedding.service';
import { VectorIndexService } from './vector-index.service';
import { PipelineOrchestrator } from './pipeline.orchestrator';

/**
 * 文档处理管线：分块 → 向量化（后续可扩展 ES 写入）
 * 仅提供 Provider，供其他模块注入使用。
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DocumentContent.name, schema: DocumentContentSchema },
    ]),
  ],
  providers: [
    ChunkingService,
    EmbeddingService,
    VectorIndexService,
    PipelineOrchestrator,
  ],
  exports: [PipelineOrchestrator, VectorIndexService],
})
export class PipelineModule {}
