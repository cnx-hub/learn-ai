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
    @Inject('SEND_MAIL_TOOL') private readonly sendMailTool: StructuredTool,
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: StructuredTool,
    @Inject('DB_USERS_CRUD_TOOL')
    private readonly dbUsersCrudTool: StructuredTool,
    @Inject('CRON_JOB_TOOL') private readonly cronJobTool: StructuredTool,
    @Inject('TIME_NOW_TOOL') private readonly timeNowTool: StructuredTool,
  ) {
    this.modelWithTools = model.bindTools([
      this.queryUserTool,
      this.sendMailTool,
      this.webSearchTool,
      this.dbUsersCrudTool,
      this.cronJobTool,
      this.timeNowTool,
    ]);
  }

  async runChain(query: string): Promise<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(
        `你是一个通用任务助手，可以根据用户的目标规划步骤，并在需要时调用工具：\`query_user\` 查询或校验用户信息、\`send_mail\` 发送邮件、\`web_search\` 进行互联网搜索、\`db_users_crud\` 读写数据库 users 表、\`time_now\` 获取当前服务器时间、\`cron_job\` 创建和管理定时/周期任务（\`list\`/\`add\`/\`toggle\`），从而实现提醒、定期任务、数据同步等各种自动化需求。

定时任务类型选择规则（非常重要）：
- 用户说“X分钟/小时/天后”“在某个时间点”“到点提醒”（一次性）=> 用 \`cron_job\` + \`type=at\`（执行一次后自动停用），\`at\`=当前时间+X 或解析出的时间点。
- 注意：\`time_now\` 提供的是 UTC 时间，你在计算 \`at\` 字段时必须使用该 UTC 时间。但在给用户回复确认信息时，请务必将时间转换为北京时间 (UTC+8) 以便用户理解。
- 用户说“每X分钟/每小时/每天”“定期/循环/一直”（重复执行）=> 用 \`cron_job\` + \`type=every\`（每次执行），\`everyMs\`=X换算成毫秒
- 用户给出 Cron 表达式或明确说“用 cron 表达式”（重复执行）=> 用 \`cron_job\` + \`type=cron\`

在调用 \`cron_job.add\` 创建任务时，需要把用户原始自然语言拆成两部分：一部分是“什么时候执行”（用来决定 type/at/everyMs/cron），另一部分是“要做什么任务本身”。\`instruction\` 字段只能填“要做什么”的那部分文本（保持原语言和原话），不能再改写、翻译或总结。

当用户请求“在未来某个时间点执行某个动作”（例如“1分钟后给我发一个笑话到邮箱”）时，本轮对话只需要使用 \`cron_job\` 设置/更新定时任务，不要在当前轮直接完成这个动作本身：不要直接调用 \`send_mail\` 给他发邮件，也不要在当前轮就真正“执行”指令，只需把要执行的动作写进 \`instruction\` 里，交给将来的定时任务去跑。

重要：\`cron_job.add\` 的 \`instruction\` 必须是自然语言任务描述，不能写成工具调用/脚本（例如禁止 \`send_mail(...)\`、\`db_users_crud(...)\`、\`web_search(...)\`）。工具调用应该由将来的 JobAgent 在执行时自行决定。

注意：像“\`1分钟后提醒我喝水\`”，时间相关信息用于计算下一次执行时间，而 \`instruction\` 应该是“提醒我喝水”；本轮不需要立刻提醒。`,
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
        } else if (toolName === 'send_mail') {
          const toolResult = (await this.sendMailTool.invoke(
            toolCall.args,
          )) as string;
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: toolResult,
            }),
          );
        } else if (toolName === 'web_search') {
          const toolResult = (await this.webSearchTool.invoke(
            toolCall.args,
          )) as string;
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: toolResult,
            }),
          );
        } else if (toolName === 'db_users_crud') {
          const toolResult = (await this.dbUsersCrudTool.invoke(
            toolCall.args,
          )) as string;
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: toolResult,
            }),
          );
        } else if (toolName === 'cron_job') {
          const toolResult = (await this.cronJobTool.invoke(
            toolCall.args,
          )) as string;
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: toolResult,
            }),
          );
        } else if (toolName === 'time_now') {
          const toolResult = (await this.timeNowTool.invoke(
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
        `你是一个通用任务助手，可以根据用户的目标规划步骤，并在需要时调用工具：\`query_user\` 查询或校验用户信息、\`send_mail\` 发送邮件、\`web_search\` 进行互联网搜索、\`db_users_crud\` 读写数据库 users 表、\`time_now\` 获取当前服务器时间、\`cron_job\` 创建和管理定时/周期任务（\`list\`/\`add\`/\`toggle\`），从而实现提醒、定期任务、数据同步等各种自动化需求。

定时任务类型选择规则（非常重要）：
- 用户说“X分钟/小时/天后”“在某个时间点”“到点提醒”（一次性）=> 用 \`cron_job\` + \`type=at\`（执行一次后自动停用），\`at\`=当前时间+X 或解析出的时间点。
- 注意：\`time_now\` 提供的是 UTC 时间，你在计算 \`at\` 字段时必须使用该 UTC 时间。但在给用户回复确认信息时，请务必将时间转换为北京时间 (UTC+8) 以便用户理解。
- 用户说“每X分钟/每小时/每天”“定期/循环/一直”（重复执行）=> 用 \`cron_job\` + \`type=every\`（每次执行），\`everyMs\`=X换算成毫秒
- 用户给出 Cron 表达式或明确说“用 cron 表达式”（重复执行）=> 用 \`cron_job\` + \`type=cron\`

在调用 \`cron_job.add\` 创建任务时，需要把用户原始自然语言拆成两部分：一部分是“什么时候执行”（用来决定 type/at/everyMs/cron），另一部分是“要做什么任务本身”。\`instruction\` 字段只能填“要做什么”的那部分文本（保持原语言和原话），不能再改写、翻译或总结。

当用户请求“在未来某个时间点执行某个动作”（例如“1分钟后给我发一个笑话到邮箱”）时，本轮对话只需要使用 \`cron_job\` 设置/更新定时任务，不要在当前轮直接完成这个动作本身：不要直接调用 \`send_mail\` 给他发邮件，也不要在当前轮就真正“执行”指令，只需把要执行的动作写进 \`instruction\` 里，交给将来的定时任务去跑。

重要：\`cron_job.add\` 的 \`instruction\` 必须是自然语言任务描述，不能写成工具调用/脚本（例如禁止 \`send_mail(...)\`、\`db_users_crud(...)\`、\`web_search(...)\`）。工具调用应该由将来的 JobAgent 在执行时自行决定。

注意：像“\`1分钟后提醒我喝水\`”，时间相关信息用于计算下一次执行时间，而 \`instruction\` 应该是“提醒我喝水”；本轮不需要立刻提醒。`,
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
        } else if (toolName === 'send_mail') {
          const toolResult = (await this.sendMailTool.invoke(
            toolCall.args,
          )) as string;
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: toolResult,
            }),
          );
        } else if (toolName === 'web_search') {
          const toolResult = (await this.webSearchTool.invoke(
            toolCall.args,
          )) as string;
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: toolResult,
            }),
          );
        } else if (toolName === 'db_users_crud') {
          const toolResult = (await this.dbUsersCrudTool.invoke(
            toolCall.args,
          )) as string;
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: toolResult,
            }),
          );
        } else if (toolName === 'cron_job') {
          const toolResult = (await this.cronJobTool.invoke(
            toolCall.args,
          )) as string;
          messages.push(
            new ToolMessage({
              tool_call_id: toolCallId,
              name: toolName,
              content: toolResult,
            }),
          );
        } else if (toolName === 'time_now') {
          const toolResult = (await this.timeNowTool.invoke(
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
