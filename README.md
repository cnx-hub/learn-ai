# AI Playground（LangChain / MCP / RAG / Memory / Milvus）

这是一个以 **LangChain + OpenAI 兼容接口** 为核心的实验仓库，包含多组独立示例，覆盖：

- 工具调用（Tool Calling）
- 流式与结构化输出解析
- 对话记忆（内存、文件、摘要、检索）
- RAG 基础流程（加载、切分、检索、回答）
- Milvus 向量数据库 CRUD 与 RAG 实战
- MCP（Model Context Protocol）客户端与自定义服务端

## 仓库结构

```text
ai/
├── tool-test/          # 工具调用、Agent 循环、MCP 客户端与本地 MCP Server
├── output-parse-test/  # 各类 Output Parser + 流式输出解析实验
├── memory-test/        # 对话记忆策略（历史、截断、摘要、检索）
├── rag-test/           # 内存向量 RAG + 文本切分器实验
├── milvus-test/        # Milvus CRUD + 日记/电子书向量检索与 RAG
├── .env                # 运行配置（本地）
└── package.json        # 根目录依赖（部分示例共用）
```

## 技术栈

- Node.js ESM (`.mjs`)
- LangChain (`@langchain/openai`, `@langchain/core`, `@langchain/community`, `@langchain/mcp-adapters`)
- Zod（结构化输出 schema）
- Milvus (`@zilliz/milvus2-sdk-node`)
- js-tiktoken（token 计数与切分）
- MCP SDK (`@modelcontextprotocol/sdk`)

## 环境变量

在仓库根目录 `.env` 中配置（不同脚本按需读取）：

```bash
MODEL_NAME=...
API_KEY=...
BASE_URL=...
EMBEDDINGS_MODEL_NAME=...

# 仅 MCP 示例需要
AMAP_MAPS_API_KEY=...
ALLOWED_PATHS=/abs/path1,/abs/path2
```

## 快速开始

1. 安装依赖（根目录）

```bash
npm install
```

2. 进入对应子目录运行示例（或在根目录直接 `node 子目录/脚本`）

```bash
# 示例
node output-parse-test/src/normal.mjs
node memory-test/src/history-test.mjs
```

3. 若运行 Milvus 相关脚本，先确保 Milvus 在本地启动（默认 `localhost:19530`）。

## 文件级知识点索引

以下按子项目列出全部 `47` 个 `*.mjs` 文件，每个文件对应一个核心知识点。

## `tool-test`（8 个文件）

| 文件 | 知识点总结 |
| --- | --- |
| `tool-test/src/hello-langchain.mjs` | 最小化 `ChatOpenAI.invoke` 调用链，验证 `.env` 与模型连通性。 |
| `tool-test/src/tool-file-read.mjs` | 自定义 `read_file` 工具 + `tool_calls` 循环执行 + `ToolMessage` 回灌。 |
| `tool-test/src/all-tools.mjs` | 将读写文件、执行命令、列目录封装成可复用工具层（Zod 参数约束）。 |
| `tool-test/src/mini-cursor.mjs` | 多工具 Agent 执行框架，演示“规划-调用工具-继续推理”的迭代闭环。 |
| `tool-test/src/node-exec.mjs` | `child_process.spawn` 实时输出子进程日志与退出码处理。 |
| `tool-test/src/my-mcp-server.mjs` | 从零实现 MCP Server：注册 Tool/Resource 并通过 stdio 暴露能力。 |
| `tool-test/src/langchain-mcp-test.mjs` | LangChain MCP 客户端调用本地 MCP Server，实现“模型 -> MCP 工具”联动。 |
| `tool-test/src/mcp-test.mjs` | 多 MCP 服务并行接入（地图/文件系统/devtools）与资源预读注入系统提示。 |

## `output-parse-test`（13 个文件）

| 文件 | 知识点总结 |
| --- | --- |
| `output-parse-test/src/initConfig.mjs` | 统一模型初始化配置，避免各示例重复创建 `ChatOpenAI`。 |
| `output-parse-test/src/normal.mjs` | 无 parser 场景下的“提示词约束 JSON + 手工 `JSON.parse`”基线做法。 |
| `output-parse-test/src/json-output-parser.mjs` | `JsonOutputParser` 的格式指令生成与解析流程。 |
| `output-parse-test/src/xml-output-parser.mjs` | `XMLOutputParser` 的 XML 结构化输出解析路径。 |
| `output-parse-test/src/structured-output-parser.mjs` | `StructuredOutputParser.fromNamesAndDescriptions` 的字段级约束能力。 |
| `output-parse-test/src/structured-output-parser2.mjs` | `StructuredOutputParser.fromZodSchema` 的强类型校验与复杂嵌套结构。 |
| `output-parse-test/src/with-structured-output.mjs` | `model.withStructuredOutput(..., { method: "functionCalling" })` 的简化结构化输出方案。 |
| `output-parse-test/src/tool-calls-args.mjs` | 手动处理 tool calling 多轮对话，提取并验证 `toolCall.args`。 |
| `output-parse-test/src/stream-normal.mjs` | 普通文本流式输出的 chunk 拼接与实时打印。 |
| `output-parse-test/src/stream-structured-partial.mjs` | 流式接收结构化文本时的增量消费模式。 |
| `output-parse-test/src/stream-with-structured-output.mjs` | 结构化对象流（function calling 模式）与最终结果汇总。 |
| `output-parse-test/src/stream-tool-calls-raw.mjs` | 直接观察 `tool_call_chunks[].args` 的原始增量片段。 |
| `output-parse-test/src/stream-tool-calls-parser.mjs` | `JsonOutputKeyToolsParser` + TTY 重绘，实现“非重复”的流式参数渲染。 |

## `memory-test`（8 个文件）

| 文件 | 知识点总结 |
| --- | --- |
| `memory-test/src/history-test.mjs` | `InMemoryChatMessageHistory` 管理短会话上下文。 |
| `memory-test/src/history-test2.mjs` | `FileSystemChatMessageHistory` 持久化消息到 `chat_history.json`。 |
| `memory-test/src/history-test3.mjs` | 从持久化历史恢复上下文并继续新一轮对话。 |
| `memory-test/src/memory/truncation-memory.mjs` | 对话裁剪策略：按条数截断 vs 按 token 截断。 |
| `memory-test/src/memory/summarization-memory.mjs` | 超长历史触发摘要压缩，保留最近消息与关键信息。 |
| `memory-test/src/memory/summarization-memory2.mjs` | 基于 token 阈值的摘要记忆策略（更贴近真实成本控制）。 |
| `memory-test/src/memory/insert-conversations.mjs` | 将对话样本向量化写入 Milvus，构建检索式长期记忆底座。 |
| `memory-test/src/memory/retrieval-memory.mjs` | 检索相关历史对话并注入上下文，实现 retrieval memory。 |

## `rag-test`（10 个文件）

| 文件 | 知识点总结 |
| --- | --- |
| `rag-test/src/hello-rag.mjs` | 纯内存向量库 `MemoryVectorStore` 的最小 RAG 闭环。 |
| `rag-test/src/loader-and-splitter.mjs` | 网页加载 + `RecursiveCharacterTextSplitter` 基础切分。 |
| `rag-test/src/loader-and-splitter2.mjs` | 文档切分、向量检索、带上下文回答的一体化流程。 |
| `rag-test/src/tiktoken-test.mjs` | 文本 token 计数实验，观察中英文 token 差异。 |
| `rag-test/src/splitters/CharacterTextSplitter.mjs` | 固定分隔符切分行为与 chunk 长度观测。 |
| `rag-test/src/splitters/TokenTextSplitter.mjs` | 按 token 长度切分，保证片段接近模型计费单位。 |
| `rag-test/src/splitters/RecursiveCharacterTextSplitter.mjs` | 递归分隔优先级切分，平衡语义完整性与长度约束。 |
| `rag-test/src/splitters/MarkdownTextSplitter.mjs` | Markdown 结构感知切分，尽量保持标题/代码块语义边界。 |
| `rag-test/src/splitters/LatexTextSplitter.mjs` | LaTeX 公式文本切分，适配数学语料。 |
| `rag-test/src/splitters/RecursiveSplitterCode.mjs` | 代码语料切分（`fromLanguage('js')`）以减少语法上下文破坏。 |

## `milvus-test`（8 个文件）

| 文件 | 知识点总结 |
| --- | --- |
| `milvus-test/src/insert.mjs` | 向量集合创建、索引构建、日记数据向量化入库。 |
| `milvus-test/src/query.mjs` | 通过 embedding 向量检索相似记录并输出结构化字段。 |
| `milvus-test/src/update.mjs` | `upsert` 更新已有向量记录并同步元数据。 |
| `milvus-test/src/detele.mjs` | Milvus 删除模式：单条删除、批量删除、条件删除。 |
| `milvus-test/src/rag.mjs` | 日记场景的检索增强问答（检索 -> 构造上下文 -> 生成回答）。 |
| `milvus-test/src/ebook-writer.mjs` | EPUB 章节流式切块、向量化、批量写入 `ebook_collection`。 |
| `milvus-test/src/ebook-query.mjs` | 小说片段向量检索与章节定位。 |
| `milvus-test/src/ebook-rag.mjs` | 小说问答 RAG：检索命中片段并综合生成情节回答。 |

## 推荐学习顺序

1. `tool-test/src/hello-langchain.mjs`（最小调用）
2. `output-parse-test`（输出解析与流式）
3. `memory-test`（历史、截断、摘要）
4. `rag-test`（内存向量 RAG）
5. `milvus-test`（落地到 Milvus）
6. `tool-test` MCP 系列（多工具编排）

## 常见问题

- `*.md` 被根目录 `.gitignore` 忽略：
  - 当前仓库配置了 `*.md`，README 不会出现在 `git status`。

- Milvus 连接失败：
  - 检查服务是否启动，地址是否为 `localhost:19530`。

- 模型调用报错：
  - 检查 `.env` 中 `MODEL_NAME / API_KEY / BASE_URL`。
