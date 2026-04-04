import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ChatOpenAI } from '@langchain/openai';
import { FileSystemChatMessageHistory } from "@langchain/community/stores/message/file_system";
import { SystemMessage, HumanMessage } from '@langchain/core/messages'

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

const model = new ChatOpenAI({
    modelName: process.env.MODEL_NAME,
    apiKey: process.env.API_KEY,
    configuration: {
        baseURL: process.env.BASE_URL
    }
});

async function fileHistoryDemo() {
    try {
        const filePath = join(process.cwd(), 'chat_history.json');
        const sessionId = "user_session_001";

        const history = new FileSystemChatMessageHistory({
            filePath,
            sessionId,
            userId: 'user_001'
        });

        // 系统提示词
        const systemMessage = new SystemMessage(
            "你是一个友好的做菜助手，喜欢分享美食和烹饪技巧。"
        );

        console.log("[第一轮对话]");
        const userMessage1 = new HumanMessage(
            "红烧肉怎么做"
          );
          await history.addMessage(userMessage1);
          const messages1 = [systemMessage, ...(await history.getMessages())];
          const response1 = await model.invoke(messages1);
          await history.addMessage(response1);

        console.log(`用户: ${userMessage1.content}`);
        console.log(`助手: ${response1.content}`);
        console.log(`✓ 对话已保存到文件: ${filePath}\n`);

        const userMessage2 = new HumanMessage("好吃吗？");
        await history.addMessage(userMessage2);
        const messages2 = [systemMessage, ...(await history.getMessages())];
        const response2 = await model.invoke(messages2);
        await history.addMessage(response2);

        console.log(`用户: ${userMessage2.content}`);
        console.log(`助手: ${response2.content}`);
        console.log(`✓ 对话已更新到文件\n`);

    } catch (error) {
        console.log("error: ", error)
        return error.message
    }
};

fileHistoryDemo().catch(console.error)