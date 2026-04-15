import { model } from '../initConfig.mjs';
import { z } from 'zod';
import mysql from 'mysql2/promise';

const friendSchema = z.object({
    name: z.string().describe('姓名'),
    gender: z.string().describe('性别（男/女）'),
    birth_date: z.string().describe('出生日期，格式：YYYY-MM-DD，如果无法确定具体日期，根据年龄估算'),
    company: z.string().nullable().describe('公司名称，如果没有则返回 null'),
    title: z.string().nullable().describe('职位/头衔，如果没有则返回 null'),
    phone: z.string().nullable().describe('手机号，如果没有则返回 null'),
    wechat: z.string().nullable().describe('微信号，如果没有则返回 null'),
});

const extractionSchema = z.union([
    // z.array(friendSchema),
    z.object({
        info_array: z.union([
            z.array(friendSchema),
            z.string(),
        ]),
    }),
]);

// const extractionSchema = z.array(friendSchema).describe('好友信息数组');

const structuredModel = model.withStructuredOutput(extractionSchema, {
    method: 'functionCalling',
});


// 数据库连接配置
const connectionConfig = {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'admin',
    connectTimeout: 10000,
    multipleStatements: true,
};

function normalizeResults(rawOutput) {
    if (Array.isArray(rawOutput)) {
        return rawOutput.map((item) => friendSchema.parse(item));
    }

    const infoArray = rawOutput?.info_array;
    if (Array.isArray(infoArray)) {
        return infoArray.map((item) => friendSchema.parse(item));
    }

    if (typeof infoArray === 'string') {
        let parsed;
        try {
            parsed = JSON.parse(infoArray);
        } catch (error) {
            throw new Error(`info_array 不是合法 JSON：${error?.message || error}`);
        }

        if (!Array.isArray(parsed)) {
            throw new Error('info_array 解析后不是数组');
        }

        return parsed.map((item) => friendSchema.parse(item));
    }

    throw new Error('模型输出不包含可用的好友数组');
}

async function extractAndInsert(text) {
    let connection;
    try {
        console.log('🔌 正在连接 MySQL...');
        connection = await mysql.createConnection(connectionConfig);
        console.log('✅ MySQL 连接成功');

        // 切换到 hello 数据库
        console.log('🗄️  正在切换数据库 hello...');
        await connection.query(`USE hello;`);
        console.log('✅ 数据库切换成功');

        // 使用 AI 提取结构化信息
        console.log('🤔 正在从文本中提取信息...\n');
        const prompt = `请从以下文本中提取所有好友信息，文本中可能包含一个或多个人的信息。请将每个人的信息分别提取出来，返回一个数组。

${text}

要求：
1. 如果文本中包含多个人，请为每个人创建一个对象
2. 每个对象包含以下字段：
   - 姓名：提取文本中的人名
   - 性别：提取性别信息（男/女）
   - 出生日期：如果能找到具体日期最好，否则根据年龄描述估算（格式：YYYY-MM-DD）
   - 公司：提取公司名称
   - 职位：提取职位/头衔信息
   - 手机号：提取手机号码
   - 微信号：提取微信号
3. 如果某个字段在文本中找不到，请返回 null
4. 返回格式优先为 {"info_array":[...]}，也可直接返回数组 [...]
5. 输出必须是合法 JSON，不要输出额外解释文本
`;

        const rawOutput = await structuredModel.invoke(prompt);
        const results = normalizeResults(rawOutput);

        console.log(`✅ 提取到 ${results.length} 条结构化信息:`);
        console.log(JSON.stringify(results, null, 2));

        if (results.length === 0) {
            console.log('⚠️  没有提取到任何信息');
            return { count: 0, insertIds: [] };
        }


        // 批量插入数据库
        const insertSql = `
      INSERT INTO friends (
        name,
        gender,
        birth_date,
        company,
        title,
        phone,
        wechat
      ) VALUES ?;
    `;

        const values = results.map((result) => [
            result.name,
            result.gender,
            result.birth_date || null,
            result.company,
            result.title,
            result.phone,
            result.wechat,
        ]);

        console.log('💾 正在批量写入 MySQL...');
        const [insertResult] = await connection.query(insertSql, [values]);
        console.log(`✅ 成功批量插入 ${insertResult.affectedRows} 条数据`);
        console.log(`   插入的ID范围：${insertResult.insertId} - ${insertResult.insertId + insertResult.affectedRows - 1}`);

        return {
            count: insertResult.affectedRows,
            insertIds: Array.from({ length: insertResult.affectedRows }, (_, i) => insertResult.insertId + i),
        };

    } catch (error) {
        console.error('❌ 执行出错：', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
            console.log('🔒 MySQL 连接已关闭');
        }
    }
}


async function main() {
    try {
        const sampleText = `我最近认识了几个新朋友。第一个是张总，女的，看起来30出头，在腾讯做技术总监，手机13800138000，微信是zhangzong2024。第二个是李工，男，大概28岁，在阿里云做架构师，电话15900159000，微信号lee_arch。还有一个是陈经理，女，35岁左右，在美团做产品经理，手机号是18800188000，微信chenpm2024。`;

        console.log('📝 输入文本:');
        console.log(sampleText);

        const result = await extractAndInsert(sampleText);
        // console.log(`\n🎉 处理完成！成功插入 ${result.count} 条记录`);
        // console.log(`   插入的ID：${result.insertIds.join(', ')}`);
    } catch (error) {
        console.error('❌ 处理失败：', error?.message || error);
        process.exit(1);
    }
}

main();
