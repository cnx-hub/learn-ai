import { Module } from '@nestjs/common';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './embedding.service';

/**
 * 文档处理管线：分块 → 向量化（后续可扩展 ES 写入）
 * 仅提供 Provider，供其他模块注入使用。
 */
@Module({
  providers: [ChunkingService, EmbeddingService],
  exports: [ChunkingService, EmbeddingService],
})
export class PipelineModule {}
