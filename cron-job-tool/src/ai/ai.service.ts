import { Injectable, Inject } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { Runnable } from '@langchain/core/runnables';
import { StructuredTool } from '@langchain/core/tools';
import {
  BaseMessage,
  AIMessage,
  SystemMessage,
  HumanMessage,
  ToolMessage,
  AIMessageChunk,
} from '@langchain/core/messages';
// import { tool } from '@langchain/core/tools';
// import { z } from 'zod';

// const database = {
//   users: {
//     '001': {
//       id: '001',
//       name: '张三',
//       email: 'zhangsan@exampble.com',
//       role: 'admin',
//     },
//     '002': { id: '002', name: '李四', email: 'lisi@example.com', role: 'user' },
//     '003': {
//       id: '003',
//       name: '王五',
//       email: 'wangwu@example.com',
//       role: 'user',
//     },
//   },
// };

// const queryUserArgsSchema = z.object({
//   userId: z.string().describe('用户 ID，例如：001，002，003'),
// });

// type QueryUserArgs = {
//   userId: string;
// };

// interface User {
//   id: string;
//   name: string;
//   email: string;
//   role: 'user' | 'admin' | 'other'; // 根据实际情况调整
// }

// const queryUserTool = tool(
//   ({ userId }: QueryUserArgs) => {
//     const user = database.users[userId] as User | undefined;

//     if (!user) {
//       return `用户 ID ${userId} 不存在。可用的 ID: 001, 002, 003`;
//     }

//     return `用户信息：\n- ID: ${user.id}\n- 姓名: ${user.name}\n- 邮箱: ${user.email}\n- 角色: ${user.role}`;
//   },
//   {
//     name: 'query_user',
//     description:
//       '查询数据库中的用户信息。输入用户 ID，返回该用户的详细信息（姓名、邮箱、角色）。',
//     schema: queryUserArgsSchema,
//   },
// );

@Injectable()
export class AiService {
  private readonly modelWithTools: Runnable<BaseMessage[], AIMessage>;

  constructor(
    @Inject('CHAT_MODEL') model: ChatOpenAI,
    @Inject('QUERY_USER_TOOL') private readonly queryUserTool: StructuredTool,
  ) {
    this.modelWithTools = model.bindTools([this.queryUserTool]);
  }

  async runChain(query: string): Promise<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(
        '你是一个通用任务助手，可以根据用户的目标规划步骤，并在需要时调用工具（如 query_user）查询用户信息，再来回答对应的问题',
      ),
      new HumanMessage(query),
    ];

    while (true) {
      const aiMsg = await this.modelWithTools.invoke(messages);
      messages.push(aiMsg);

      if (!aiMsg.tool_calls?.length) {
        return aiMsg.content as string;
      }

      for (const toolCall of aiMsg.tool_calls) {
        const toolCallId = toolCall.id ?? '';
        const toolName = toolCall.name;

        if (toolName === 'query_user') {
          const toolResult = (await this.queryUserTool.invoke(
            toolCall.args,
          )) as string;
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: toolResult,
            }),
          );
        }
      }
    }
  }

  async *runStreamChain(query: string): AsyncIterable<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(
        '你是一个通用任务助手，可以根据用户的目标规划步骤，并在需要时调用工具（如 query_user）查询用户信息，再来回答对应的问题',
      ),
      new HumanMessage(query),
    ];

    while (true) {
      const stream = await this.modelWithTools.stream(messages);

      let fullAiMessage: AIMessageChunk | null = null;
      for await (const chunk of stream as AsyncIterable<AIMessageChunk>) {
        fullAiMessage = fullAiMessage ? fullAiMessage.concat(chunk) : chunk;

        const hasToolChunk =
          fullAiMessage?.tool_call_chunks &&
          fullAiMessage.tool_call_chunks.length > 0;

        if (!hasToolChunk && chunk.content) {
          yield chunk.content as string;
        }
      }

      if (!fullAiMessage) {
        return '';
      }

      messages.push(fullAiMessage);

      if (!fullAiMessage.tool_calls?.length) {
        return '';
      }

      for (const toolCall of fullAiMessage.tool_calls) {
        const toolCallId = toolCall.id ?? '';
        const toolName = toolCall.name;

        if (toolName === 'query_user') {
          const toolResult = (await this.queryUserTool.invoke(
            toolCall.args,
          )) as string;
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: toolResult,
            }),
          );
        }
      }
    }
  }
}
