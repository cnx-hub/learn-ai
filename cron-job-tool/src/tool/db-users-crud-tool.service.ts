import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { tool } from '@langchain/core/tools';
import { UsersService } from '../users/users.service';
import type { User as DbUser } from '../users/entities/user.entity';
import type { UpdateUserDto } from '../users/dto/update-user.dto';

type DbUsersCrudAction = 'create' | 'list' | 'get' | 'update' | 'delete';

type DbUsersCrudArgs = {
    action: DbUsersCrudAction;
    id?: number;
    name?: string;
    email?: string;
};

const formatDbUser = (user: DbUser) =>
    `ID=${user.id}，姓名=${user.name}，邮箱=${user.email}，创建时间=${user.createdAt?.toLocaleString() ?? ''}`;

@Injectable()
export class DbUsersCrudToolService {
    readonly tool;

    private readonly usersService: UsersService;

    constructor() {
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

        this.tool = tool(
            async ({ action, id, name, email }: DbUsersCrudArgs) => {
                switch (action) {
                    case 'create': {
                        if (!name || !email) {
                            return '创建用户需要同时提供 name 和 email。';
                        }

                        const created = await this.usersService.create({ name, email });
                        return `已创建用户：ID=${created.id}，姓名=${created.name}，邮箱=${created.email}`;
                    }
                    case 'list': {
                        const users = await this.usersService.findAll();
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
                        const user = await this.usersService.findOne(id);
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
                        const existing = await this.usersService.findOne(id);
                        if (!existing) {
                            return `ID 为 ${id} 的用户在数据库中不存在。`;
                        }
                        await this.usersService.update(id, payload);
                        const updated = await this.usersService.findOne(id);
                        return `已更新用户：ID=${id}，姓名=${updated?.name}，邮箱=${updated?.email}`;
                    }
                    case 'delete': {
                        if (!id) {
                            return '删除用户需要提供 id。';
                        }
                        const existing = await this.usersService.findOne(id);
                        if (!existing) {
                            return `ID 为 ${id} 的用户在数据库中不存在，无需删除。`;
                        }
                        await this.usersService.remove(id);
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

    }
}