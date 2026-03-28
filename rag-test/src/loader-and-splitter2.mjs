import "dotenv/config";
import "cheerio";
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL,
    },
    temperature: 0,
});

const embeddings = new OpenAIEmbeddings({
    modelName: process.env.EMBEDDINGS_MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL,
    },
});

const cheerioLoader = new CheerioWebBaseLoader(
    "https://juejin.cn/post/7233327509919547452",
    {
        selector: ".main-area p",
    },
);

const documents = await cheerioLoader.load();

console.assert(documents.length === 1);
console.log(`Total characters: ${documents[0].pageContent.length}`);

const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
    separators: ["。", "！", "？"],
});

const splitDocuments = await textSplitter.splitDocuments(documents);
console.log(`文档分割完成，共 ${splitDocuments.length} 个分块\n`);

const vectorStore = await MemoryVectorStore.fromDocuments(
    splitDocuments,
    embeddings,
  );
console.log("向量存储创建完成\n");

// const retriever = vectorStore.asRetriever({ k: 2 })

const questions = ["父亲的去世对作者的人生态度产生了怎样的根本性逆转？"];

for (const question of questions) {
    console.log("=".repeat(80));
    console.log(`问题: ${question}`);
    console.log("=".repeat(80));

    const scoredResults = await vectorStore.similaritySearchWithScore(
        question,
        2,
    );
    const retrievedDocs = scoredResults.map(([doc]) => doc);

    scoredResults.forEach(([doc, score], i) => {
        const similarity = (1 - score).toFixed(4);

        console.log(`\n[文档 ${i + 1}] 相似度: ${similarity}`);
        console.log(`内容: ${doc.pageContent}`);
        if (doc.metadata && Object.keys(doc.metadata).length > 0) {
            console.log(`元数据:`, doc.metadata);
        }
    });
    const context = retrievedDocs
        .map((doc, i) => `[片段${i + 1}]\n${doc.pageContent}`)
        .join("\n\n");

    const prompt = `你是一个文章辅助阅读助手，根据文章内容来解答：

文章内容：
${context}

问题: ${question}

你的回答:`;

    const response = await model.invoke(prompt);
    console.log(response.content);
}
