import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { MilvusClient, MetricType } from '@zilliz/milvus2-sdk-node';
import { RunnableSequence, RunnableLambda, RunnableBranch } from '@langchain/core/runnables';
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../../.env') });

const VECTOR_DIM = 1024;
const COLLECTION_NAME = 'ebook_collection';

const embedding = new OpenAIEmbeddings({
    modelName: process.env.EMBEDDINGS_MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL
    },
    dimensions: VECTOR_DIM
});

const model = new ChatOpenAI({
    temperature: 0.7,
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL,
    },
});


async function getEmbedding(text) {
    const result = await embedding.embedQuery(text);
    return result
}

const milvusClient = new MilvusClient({
    address: "localhost:19530",
});

// 组合成完整的 RAG Runnable（检索 -> 构建 Prompt 输入 -> PromptTemplate -> LLM -> 文本）
const milvusSearch = RunnableLambda.from(async (input) => {
    const { question, k } = input;

    try {
        const queryVector = await getEmbedding(question);

        const searchResult = await milvusClient.search({
            collection_name: COLLECTION_NAME,
            vector: queryVector,
            limit: k,
            metric_type: MetricType.COSINE,
            output_fields: ["id", "book_id", "chapter_num", "index", "content"],
        });

        const results = searchResult.results ?? [];

        const retrievedContent = results.map((item, idx) => ({
            id: item.id,
            book_id: item.book_id,
            chapter_num: item.chapter_num,
            index: item.index ?? idx,
            content: item.content,
            score: item.score,
        }));

        return { question, retrievedContent };

    } catch (error) {
        console.error("检索内容时出错:", error.message);
        return { question, retrievedContent: [] };
    }
});

// 构建 context + 日志打印的 Runnable
const buildPromptInput = new RunnableLambda({
    func: async (input) => {
        const { question, retrievedContent } = input;

        if (!retrievedContent.length) {
            return {
                hasContext: false,
                question,
                context: "",
                retrievedContent,
            };
        }

        // 打印检索结果
        console.log("=".repeat(80));
        console.log(`问题: ${question}`);
        console.log("=".repeat(80));
        console.log("\n【检索相关内容】");

        retrievedContent.forEach((item, i) => {
            console.log(`\n[片段 ${i + 1}] 相似度: ${item.score ?? "N/A"}`);
            console.log(`书籍: ${item.book_id}`);
            console.log(`章节: 第 ${item.chapter_num} 章`);
            console.log(`片段索引: ${item.index}`);
            const content = item.content ?? "";
            console.log(
                `内容: ${content.substring(0, 200)}${content.length > 200 ? "..." : ""
                }`
            );
        });

        const context = retrievedContent
            .map((item, i) => {
                return `[片段 ${i + 1}]
章节: 第 ${item.chapter_num} 章
内容: ${item.content}`;
            })
            .join("\n\n━━━━━\n\n");

        return {
            hasContext: true,
            question,
            context,
            retrievedContent,
        };
    },
});


// ChatPromptTemplate：负责把 context / question 拼成结构化的消息
const promptTemplate = ChatPromptTemplate.fromMessages([
    ["system", `你是一个专业的《天龙八部》小说助手。基于小说内容回答问题，用准确、详细的语言。

回答要求：
1. 如果片段中有相关信息，请结合小说内容给出详细、准确的回答
2. 可以综合多个片段的内容，提供完整的答案
3. 如果片段中没有相关信息，请如实告知用户
4. 回答要准确，符合小说的情节和人物设定
5. 可以引用原文内容来支持你的回答`],
    ["human", `请根据以下《天龙八部》小说片段内容回答问题：

{context}

用户问题: {question}`]
]);

const ragChain = RunnableSequence.from([
    milvusSearch,
    buildPromptInput,
    RunnableBranch.from([
        [
            (input) => input.hasContext,
            RunnableSequence.from([
                promptTemplate,
                model,
                new StringOutputParser(),
            ]),
        ],
        (input) => {
            const fallback = "抱歉，我没有找到相关的《天龙八部》内容。请尝试换一个问题。";
            console.log(fallback);
            return fallback;
        }
    ]),
]);

async function initMilvusCollection() {
    console.log("连接到 Milvus...");
    await milvusClient.connectPromise;
    console.log("✓ 已连接\n");

    try {
        await milvusClient.loadCollection({ collection_name: COLLECTION_NAME });
        console.log("✓ 集合已加载\n");
    } catch (error) {
        if (!error.message.includes("already loaded")) {
            throw error;
        }
        console.log("✓ 集合已处于加载状态\n");
    }
}

async function main() {
    try {
        await initMilvusCollection();

        const input = {
            question: "鸠摩智会什么武功？",
            k: 5,
        };

        console.log("=".repeat(80));
        console.log(`问题: ${input.question}`);
        console.log("=".repeat(80));
        console.log("\n【AI 流式回答】\n");


        const stream = await ragChain.stream(input);

        for await (const chunk of stream) {
            // 没有 StringOutputParser 的情况
            // process.stdout.write(chunk.content)
            process.stdout.write(chunk)
        }

    } catch (error) {
        console.error("错误:", error.message);

    }
}

main();