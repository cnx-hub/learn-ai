import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Milvus } from "@langchain/community/vectorstores/milvus";
import { DashscopeRerank } from "../rerank/dashscope-rerank.mjs";
import { Client } from "@elastic/elasticsearch";
import { StateGraph, Annotation, START, END } from '@langchain/langgraph'
import { augmentQuery, retrievalQueryStrings } from './query-augment.mjs';
import { Document } from '@langchain/core/documents';
import { ChatPromptTemplate } from '@langchain/core/prompts'

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../../.env"), quiet: true });

const INDEX = "life_notes";

const chatModel = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.API_KEY,
  configuration: {
    baseURL: process.env.BASE_URL,
  },
  temperature: 0,
});

const embeddings = new OpenAIEmbeddings({
  modelName: process.env.EMBEDDINGS_MODEL_NAME,
  apiKey: process.env.OPENAI_API_KEY,
  configuration: {
    baseURL: process.env.OPENAI_BASE_URL,
  },
});

const milvus = await Milvus.fromExistingCollection(embeddings, {
  url: "http://localhost:19530",
  collectionName: INDEX,
  textField: "doc_text",
  vectorField: "embedding",
});

const reranker = new DashscopeRerank({
  apiKey: process.env.OPENAI_API_KEY,
  model: "qwen3-rerank",
  topN: 3,
  baseUrl: process.env.RERANK_URL,
});

const esClient = new Client({
  node: "http://localhost:9200",
})

const HybridRetrievalState = Annotation.Root({
  query: Annotation(),
  queryAugmentation: Annotation(),
  milvusHits: Annotation(),
  esHits: Annotation(),
  merged: Annotation(),
  topDocuments: Annotation(),
  answer: Annotation(),
});

const docFromEsHit = (hit) => {
  const s = hit._source ?? {};
  const text = [s.note_title ?? s.title, s.note_body ?? s.content]
    .filter(Boolean)
    .join("\n");;

  return new Document({
    pageContent: text,
    metadata: { id: hit._id, source: "es", ...s },
  })
}

/** 去重键仅为 metadata.id（trim 后非空）；无 id 丢弃，不按正文去重；保留首次出现顺序 */
function dedupeDocsById(docs) {
  const seen = new Set();
  const out = [];
  for (const d of docs ?? []) {
    if (!d?.pageContent) continue;
    const id =
      d.metadata?.id != null ? String(d.metadata.id).trim() : "";
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(d);
  }
  return out;
}

/** ES 与 Milvus 结果拼接后仅按 metadata.id 去重，保留首次出现（通常 ES 在前） */
function merge(esDocs, milvusDocs) {
  const combined = [...(esDocs ?? []), ...(milvusDocs ?? [])].filter(
    (d) => d?.pageContent,
  );
  return dedupeDocsById(combined);
}

const NO_CONTEXT_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    `你是阅读用户「生活笔记」知识库并作答的助手。当前没有检索到任何片段。
请用一两句话说明无法从笔记中回答，并礼貌询问用户是否换个说法或补充关键词。`,
  ],
  ["human", "用户问题：{query}"],
]);

const ANSWER_PROMPT = ChatPromptTemplate.fromMessages([
  [
    "system",
    `你是阅读用户「生活笔记」知识库并作答的助手。
规则：
- 只根据下方「检索片段」推断答案；片段里没有的信息不要编造。
- 若片段不足以回答，明确说明「笔记里未提到」，并可给出一句保守建议。
- 回答简洁有条理，可使用简短列表；口吻自然中文。`,
  ],
  [
    "human",
    `用户问题：{query}

检索片段：
{context}`,
  ],
]);

function stringifyMessageContent(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return String(content ?? "");
  return content
    .map((c) =>
      typeof c === "string" ? c : typeof c?.text === "string" ? c.text : "",
    )
    .join("");
}

function formatDocsAsContext(docs) {
  return (docs ?? [])
    .map((d, i) => {
      const meta = d.metadata ?? {};
      const src = meta.source ?? "";
      const id = meta.id != null ? String(meta.id) : "";
      const head = id ? `[${i + 1}] id=${id}${src ? ` source=${src}` : ""}` : `[${i + 1}]`;
      return `${head}\n${d.pageContent ?? ""}`;
    })
    .join("\n\n---\n\n");
}


function compileHybridRetrievalGraph(esClient, milvus, reranker, chatModel) {
  const ES_K = 15;
  const MILVUS_K = 15;

  return new StateGraph(HybridRetrievalState)
    .addNode('query_augment', async (state) => {
      const augmentation = await augmentQuery(chatModel, state.query)
      return { ...state, queryAugmentation: augmentation }
    })
    .addNode('es_recall', async (state) => {
      const qs = retrievalQueryStrings(state.query, state.queryAugmentation);
      const n = Math.max(1, qs.length);
      const kEach = Math.max(2, Math.ceil(ES_K / n));
      const batches = await Promise.all(qs.map((q) => {
        return esClient.search({
          index: INDEX,
          size: kEach,
          query: {
            multi_match: {
              query: q,
              fields: ["note_title^2", "note_body", "title", "content"],
              type: "best_fields",
              analyzer: "ik_smart",
            },
          },
        })
      }));

      const flat = batches.flatMap((res) =>
        (res.hits?.hits ?? []).map(docFromEsHit),
      );

      return { esHits: dedupeDocsById(flat) }
    })
    .addNode('milvus_recall', async (state) => {
      const qs = retrievalQueryStrings(state.query, state.queryAugmentation);
      const n = Math.max(1, qs.length);
      const kEach = Math.max(2, Math.ceil(MILVUS_K / n));
      const batches = await Promise.all(qs.map(async (q) =>
        await milvus.similaritySearch(q, kEach)
      ));

      const flat = batches.flat();

      return { milvusHits: dedupeDocsById(flat) }
    })
    .addNode('merge', async (state) => {
      return { merged: merge(state.esHits, state.milvusHits) }
    })
    .addNode('rerank', async (state) => {
      const merged = state.merged ?? [];
      if (!merged.length) return { topDocuments: [] };
      const topDocuments = await reranker.compressDocuments(merged, state.query);
      return { topDocuments }
    })
    .addNode('generate_answer', async (state) => {
      const query = state.query ?? "";
      const docs = state.topDocuments ?? [];
      if (!docs.length) {
        const chain = NO_CONTEXT_PROMPT.pipe(chatModel);
        const msg = await chain.invoke({ query });
        return { answer: stringifyMessageContent(msg.content).trim() };
      }

      const chain = ANSWER_PROMPT.pipe(chatModel);
      const msg = await chain.invoke({
        query,
        context: formatDocsAsContext(docs),
      });
      return { answer: stringifyMessageContent(msg.content).trim() };
    })
    .addEdge(START, 'query_augment')
    .addEdge('query_augment', 'es_recall')
    .addEdge('query_augment', 'milvus_recall')
    .addEdge(['es_recall', 'milvus_recall'], 'merge')
    .addEdge('merge', 'rerank')
    .addEdge('rerank', 'generate_answer')
    .addEdge('generate_answer', END)
    .compile();
}


const graph = compileHybridRetrievalGraph(esClient, milvus, reranker, chatModel);
const drawable = await graph.getGraphAsync();
console.log(drawable.drawMermaid());

const SAMPLE_QUERIES = [
  "PO-20250409-K9 滤芯订单",
  // "家里无线老是断断续续的咋整啊",
  // "那个黑凉粉粉怎么冲不结块",
  // "明火炖太久汤汁又黏又涩，起锅前要怎么处理才不腻",
];

function printQueryRewrite(original, augmentation) {
  const qs = augmentation?.queries ?? [];
  const forRetrieval = retrievalQueryStrings(original, augmentation);

  console.log(`\n--- 查询扩展（LLM 生成 ${qs.length} 条检索问句）---`);
  console.log("原始 query:", original ?? "");
  for (let i = 0; i < qs.length; i++) console.log(`  [${i + 1}] ${qs[i] ?? ""}`);
  console.log(
    `\n逐条 ES + Milvus（共 ${forRetrieval.length} 条检索串，含原始问题）:`,
  );
  for (let i = 0; i < forRetrieval.length; i++) {
    console.log(`  [${i + 1}] ${forRetrieval[i] ?? ""}`);
  }
}

function printDocs(label, docs) {
  console.log(`\n=== ${label} (${docs?.length ?? 0} 条) ===`);
  for (let i = 0; i < (docs ?? []).length; i++) {
    const d = docs[i];
    const preview = (d.pageContent ?? "").slice(0, 200).replace(/\n/g, " ");
    console.log(`[${i}] ${preview}${d.pageContent?.length > 200 ? "…" : ""}`);
    console.log(`    metadata:`, d.metadata ?? {});
  }
}

for (const query of SAMPLE_QUERIES) {
  console.log(`query: ${query}`);

  const state = await graph.invoke({ query });

  printQueryRewrite(state.query, state.queryAugmentation);
  console.log("\n（原始 JSON）", JSON.stringify(state.queryAugmentation));

  printDocs("Elasticsearch 检索", state.esHits);
  printDocs("Milvus 检索", state.milvusHits);
  printDocs("重排后保留", state.topDocuments ?? []);

  console.log("\n=== 大模型生成回答 ===\n");
  console.log(state.answer ?? "");
}