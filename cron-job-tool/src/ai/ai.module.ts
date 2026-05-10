import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { UserService } from './user.service';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import type { UpdateUserDto } from '../users/dto/update-user.dto';
import type { User as DbUser } from '../users/entities/user.entity';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { MailerService } from '@nestjs-modules/mailer';

type DbUsersCrudAction = 'create' | 'list' | 'get' | 'update' | 'delete';

type DbUsersCrudArgs = {
  action: DbUsersCrudAction;
  id?: number;
  name?: string;
  email?: string;
};

const formatDbUser = (user: DbUser) =>
  `ID=${user.id}，姓名=${user.name}，邮箱=${user.email}，创建时间=${user.createdAt?.toISOString() ?? ''}`;

@Module({
  imports: [UsersModule],
  controllers: [AiController],
  providers: [
    AiService,
    UserService,
    {
      provide: 'CHAT_MODEL',
      useFactory: (configService: ConfigService) => {
        return new ChatOpenAI({
          temperature: 0.7,
          model: configService.get<string>('MODEL_NAME'),
          apiKey: configService.get<string>('OPENAI_API_KEY'),
          configuration: {
            baseURL: configService.get<string>('OPENAI_BASE_URL'),
          },
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'QUERY_USER_TOOL',
      useFactory: (userService: UserService) => {
        const queryUserArgsSchema = z.object({
          userId: z.string().describe('用户 ID'),
        });

        return tool(
          ({ userId }: { userId: string }) => {
            const user = userService?.findOne(userId);

            if (!user) {
              const availableIds = userService
                .findAll()
                .map((u) => u.id)
                .join(', ');

              return `用户 ID ${userId} 不存在。可用的 ID: ${availableIds}`;
            }

            return `用户信息：\n- ID: ${user.id}\n- 姓名: ${user.name}\n- 邮箱: ${user.email}\n- 角色: ${user.role}`;
          },
          {
            name: 'query_user',
            description:
              '查询数据库中的用户信息。输入用户 ID，返回该用户的详细信息（姓名、邮箱、角色）。',
            schema: queryUserArgsSchema,
          },
        );
      },
      inject: [UserService],
    },
    {
      provide: 'SEND_MAIL_TOOL',
      useFactory: (
        mailerService: MailerService,
        configService: ConfigService,
      ) => {
        const sendMailArgsSchema = z.object({
          to: z
            .string()
            .email()
            .describe('收件人邮箱地址，例如：someone@example.com'),
          subject: z.string().describe('邮件主题'),
          text: z.string().optional().describe('纯文本内容，可选'),
          html: z.string().optional().describe('HTML 内容，可选'),
        });

        return tool(
          async ({
            to,
            subject,
            text,
            html,
          }: {
            to: string;
            subject: string;
            text?: string;
            html?: string;
          }) => {
            const fallbackFrom = configService.get<string>('MAIL_FROM');

            await mailerService.sendMail({
              to,
              subject,
              text: text ?? '（无文本内容）',
              html: html ?? `<p>${text ?? '（无 HTML 内容）'}</p>`,
              from: fallbackFrom,
            });

            return `邮件已发送到 ${to}，主题为「${subject}」`;
          },
          {
            name: 'send_mail',
            description:
              '发送电子邮件。可向任意合法邮箱地址发送，不要求收件人是系统用户。需要提供收件人邮箱、主题，可选文本内容和 HTML 内容。',
            schema: sendMailArgsSchema,
          },
        );
      },
      inject: [MailerService, ConfigService],
    },
    {
      provide: 'WEB_SEARCH_TOOL',
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const webSearchArgsSchema = z.object({
          query: z
            .string()
            .min(1)
            .describe('搜索关键词，例如：公司年报、某个事件等'),
          count: z
            .number()
            .int()
            .min(1)
            .max(20)
            .optional()
            .describe('返回的搜索结果数量，默认 10 条'),
        });
        return tool(
          async ({ query, count }: { query: string; count?: number }) => {
            const apiKey = configService.get<string>('BOCHA_API_KEY');
            if (!apiKey) {
              return 'Bocha Web Search 的 API Key 未配置（环境变量 BOCHA_API_KEY），请先在服务端配置后再重试。';
            }

            const url = 'https://api.bochaai.com/v1/web-search';
            const body = {
              query,
              freshness: 'noLimit',
              summary: true,
              count: count ?? 10,
            };

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify(body),
            });

            if (!response.ok) {
              return `Bocha Web Search API 请求失败，状态码：${response.status}`;
            }

            let json: {
              code: number;
              msg?: string;
              data?: {
                webPages?: {
                  value?: Array<{
                    name: string;
                    url: string;
                    summary: string;
                    siteName: string;
                    siteIcon: string;
                    dateLastCrawled: string;
                  }>;
                };
              };
            };
            try {
              json = (await response.json()) as {
                code: number;
                msg?: string;
                data?: {
                  webPages?: {
                    value?: Array<{
                      name: string;
                      url: string;
                      summary: string;
                      siteName: string;
                      siteIcon: string;
                      dateLastCrawled: string;
                    }>;
                  };
                };
              };
            } catch (e) {
              return `搜索 API 请求失败，原因是：搜索结果解析失败 ${(e as Error).message}`;
            }

            try {
              if (json.code !== 200 || !json.data) {
                return `搜索 API 请求失败，原因是: ${json.msg ?? '未知错误'}`;
              }

              const webpages = json.data.webPages?.value ?? [];
              if (!webpages.length) {
                return '未找到相关结果。';
              }

              const formatted = webpages
                .map(
                  (page, idx) =>
                    `引用: ${idx + 1}
标题: ${page.name}
URL: ${page.url}
摘要: ${page.summary}
网站名称: ${page.siteName}
网站图标: ${page.siteIcon}
发布时间: ${page.dateLastCrawled}`,
                )
                .join('\n\n');

              return formatted;
            } catch (e) {
              return `搜索 API 请求失败，原因是：搜索结果解析失败 ${(e as Error).message}`;
            }
          },
          {
            name: 'web_search',
            description:
              '使用 Bocha Web Search API 搜索互联网网页。输入为搜索关键词（可选 count 指定结果数量），返回包含标题、URL、摘要、网站名称、图标和时间等信息的结果列表。',
            schema: webSearchArgsSchema,
          },
        );
      },
    },
    {
      provide: 'DB_USERS_CRUD_TOOL',
      inject: [UsersService],
      useFactory: (usersService: UsersService) => {
        const dbUsersCrudArgsSchema = z.object({
          action: z
            .enum(['create', 'list', 'get', 'update', 'delete'])
            .describe('要执行的操作：create、list、get、update、delete'),
          id: z
            .number()
            .int()
            .positive()
            .optional()
            .describe('用户 ID（get / update / delete 时需要）'),
          name: z
            .string()
            .min(1)
            .max(50)
            .optional()
            .describe('用户姓名（create 或 update 时可用）'),
          email: z
            .email()
            .max(50)
            .optional()
            .describe('用户邮箱（create 或 update 时可用）'),
        });

        return tool(
          async ({ action, id, name, email }: DbUsersCrudArgs) => {
            switch (action) {
              case 'create': {
                if (!name || !email) {
                  return '创建用户需要同时提供 name 和 email。';
                }

                const created = await usersService.create({ name, email });
                return `已创建用户：ID=${created.id}，姓名=${created.name}，邮箱=${created.email}`;
              }
              case 'list': {
                const users = await usersService.findAll();
                if (!users.length) {
                  return '数据库中还没有任何用户记录。';
                }
                const lines = users.map(formatDbUser).join('\n');
                return `当前数据库 users 表中的用户列表：\n${lines}`;
              }
              case 'get': {
                if (!id) {
                  return '查询单个用户需要提供 id。';
                }
                const user = await usersService.findOne(id);
                if (!user) {
                  return `ID 为 ${id} 的用户在数据库中不存在。`;
                }
                return `用户信息：${formatDbUser(user)}`;
              }
              case 'update': {
                if (!id) {
                  return '更新用户需要提供 id。';
                }
                const payload: UpdateUserDto = {};
                if (name !== undefined) payload.name = name;
                if (email !== undefined) payload.email = email;
                if (!Object.keys(payload).length) {
                  return '未提供需要更新的字段（name 或 email），本次不执行更新。';
                }
                const existing = await usersService.findOne(id);
                if (!existing) {
                  return `ID 为 ${id} 的用户在数据库中不存在。`;
                }
                await usersService.update(id, payload);
                const updated = await usersService.findOne(id);
                return `已更新用户：ID=${id}，姓名=${updated?.name}，邮箱=${updated?.email}`;
              }
              case 'delete': {
                if (!id) {
                  return '删除用户需要提供 id。';
                }
                const existing = await usersService.findOne(id);
                if (!existing) {
                  return `ID 为 ${id} 的用户在数据库中不存在，无需删除。`;
                }
                await usersService.remove(id);
                return `已删除用户：ID=${id}，姓名=${existing.name}，邮箱=${existing.email}`;
              }
            }
          },
          {
            name: 'db_users_crud',
            description:
              '对数据库 users 表执行增删改查操作。通过 action 字段选择 create/list/get/update/delete，并按需提供 id、name、email 等参数。',
            schema: dbUsersCrudArgsSchema,
          },
        );
      },
    },
  ],
})
export class AiModule {}
