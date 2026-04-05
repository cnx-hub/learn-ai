import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';
import { MilvusClient, MetricType } from '@zilliz/milvus2-sdk-node';
import { InMemoryChatMessageHistory } from '@langchain/core/chat_history';
import { HumanMessage } from '@langchain/core/messages';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../../.env') });

const COLLECTION_NAME = 'conversations';
const VECTOR_DIM = 1024;

const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL,
    },
})

const embeddings = new OpenAIEmbeddings({
    modelName: process.env.EMBEDDINGS_MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL,
    },
    dimensions: VECTOR_DIM
});

const client = new MilvusClient({
    address: 'localhost:19530'
})

async function getEmbedding(text) {
    const result = await embeddings.embedQuery(text);
    return result;
};

async function retrieveRelevantConversations(input, k) {
    try {
        const queryVector = await getEmbedding(input);

        const result = await client.search({
            collection_name: COLLECTION_NAME,
            vector: queryVector,
            limit: k,
            metric_type: MetricType.COSINE,
            output_fields: ['id', 'content', 'round', 'timestamp']
        });

        return result.results;
    } catch (error) {
        console.error('检索对话时出错:', error.message);
        return [];
    }
}

async function main() {
    try {
        console.log('连接到 Milvus...');
        await client.connectPromise;
        console.log('✓ 已连接\n');
    } catch (error) {
        console.error('❌ 无法连接到 Milvus:', error.message);
        console.log('请确保 Milvus 服务正在运行（localhost:19530）');
        return;
    }


    const history = new InMemoryChatMessageHistory()
    const conversations = [
        { input: "我之前提到的机器学习项目进展如何？" },
        { input: "我周末经常做什么？" },
        { input: "我的职业是什么？" },
    ];

    for (let i = 0; i < conversations.length; i++) {
        const { input } = conversations[i];
        const userMessage = new HumanMessage(input);

        console.log(`\n[第 ${i + 1} 轮对话]`);
        console.log(`用户: ${input}`);

        // 1. 检索相关的历史对话
        console.log('\n【检索相关历史对话】');
        const retrievedConversations = await retrieveRelevantConversations(input, 2);

        let relevantHistory = "";
        if (retrievedConversations.length > 0) {
            // 显示检索到的相关历史及相似度
            retrievedConversations.forEach((conv, idx) => {
                console.log(`\n[历史对话 ${idx + 1}] 相似度: ${conv.score.toFixed(4)}`);
                console.log(`轮次: ${conv.round}`);
                console.log(`内容: ${conv.content}`);
            });

            // 构建上下文
            relevantHistory = retrievedConversations
                .map((conv, idx) => {
                    return `[历史对话 ${idx + 1}]
轮次: ${conv.round}
${conv.content}`;
                })
                .join('\n\n━━━━━\n\n');
        } else {
            console.log('未找到相关历史对话');
        }


        // 2. 构建 prompt（使用检索到的历史作为上下文）
        const contextMessages = relevantHistory
            ? [
                new HumanMessage(`相关历史对话：\n${relevantHistory}\n\n用户问题: ${input}`)
            ]
            : [userMessage];

        // 3. 调用模型生成回答
        console.log('\n【AI 回答】');
        const response = await model.invoke(contextMessages);

        await history.addMessage(userMessage);
        await history.addMessage(response);

        const conversationText = `用户: ${input}\n助手: ${response.content}`;
        const convId = `conv_${Date.now()}_${i + 1}`;
        const convVector = await getEmbedding(conversationText);

        try {
            await client.insert({
                collection_name: COLLECTION_NAME,
                data: [{
                    id: convId,
                    vector: convVector,
                    content: conversationText,
                    round: i + 1,
                    timestamp: new Date().toISOString()
                }]
            });
            console.log(`💾 已保存到 Milvus 向量数据库`);
        } catch (error) {
            console.warn('保存到向量数据库时出错:', error.message);
        }

        console.log(`助手: ${response.content}`);
    }
}

main()