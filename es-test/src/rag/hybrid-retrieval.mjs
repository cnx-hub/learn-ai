import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { Milvus } from "@langchain/community/vectorstores/milvus";
import { DashScopeRerank } from "../rerank/dashscope-rerank.mjs";
import { Client } from "@elastic/elasticsearch";

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

const milvus = Milvus.fromExistingCollection(embeddings, {
  url: "http://localhost:19530",
  collectionName: INDEX,
  textField: "doc_text",
  vectorField: "embedding",
});

const reranker = new DashScopeRerank({
  apiKey: process.env.OPENAI_API_KEY,
  model: "qwen3-rerank",
  topN: 3,
  baseUrl:
    "https://dashscope.aliyuncs.com/api/v1/services/rerank/text-rerank/text-rerank",
});

const esClient = new Client({
    node: "http://localhost:9200",
})
