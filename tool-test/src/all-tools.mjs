import fs from 'node:fs/promises';
import { tool } from "@langchain/core/tools";
import path from 'node:path';
import { z } from 'zod';
import { spawn } from "node:child_process"

const readFileTool = tool(async ({ filePath }) => {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        console.log(`  [工具调用] read_file("${filePath}") - 成功读取 ${content.length} 字节`);
        return `文件内容:\n${content}`;
    } catch (error) {
        console.error(`  [工具调用] read_file("${filePath}") - 读取失败: ${error.message}`);
        return `读取文件失败: ${error.message}`;
    }
}, {
    name: 'read_file',
    description: '读取文件内容',
    schema: z.object({
        filePath: z.string().describe('文件路径'),
    }),
});

const writeFileTool = tool(
    async ({ filePath, content }) => {
        try {
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(filePath, content, 'utf-8')
            console.log(`  [工具调用] write_file("${filePath}") - 成功写入 ${content.length} 字节`);
            return `文件写入成功`;
        } catch (error) {
            console.log(`  [工具调用] write_file("${filePath}") - 错误: ${error.message}`);
            return `写入文件失败: ${error.message}`;
        }
    },
    {
        name: 'write_file',
        description: '写入文件内容',
        schema: z.object({
            filePath: z.string().describe('文件路径'),
            content: z.string().describe('文件内容'),
        }),
    }
)


const executeCommandTool = tool(
    async ({ command, workingDirectory }) => {
        try {
            const cwd = workingDirectory
                ? path.resolve(process.cwd(), workingDirectory)
                : process.cwd();
            console.log(`  [工具调用] execute_command("${command}")${workingDirectory ? ` - 工作目录: ${cwd}` : ''}`);

            return new Promise((resolve, reject) => {
                const [cmd, ...args] = command.split(' ');

                const child = spawn(cmd, args, {
                    cwd,
                    stdio: 'inherit',
                    shell: true,
                });

                let errorMsg = '';

                child.on('error', (error) => {
                    errorMsg = error.message;
                });

                child.on('close', (code) => {
                    if (code === 0) {
                        console.log(`  [工具调用] execute_command("${command}") - 执行成功`);
                        const cwdInfo = workingDirectory
                            ? `\n\n重要提示：命令在目录 "${workingDirectory}" 中执行成功。如果需要在这个项目目录中继续执行命令，请使用 workingDirectory: "${workingDirectory}" 参数，不要使用 cd 命令。`
                            : '';
                        resolve(`命令执行成功: ${command}${cwdInfo}`);
                    } else {
                        console.log(`  [工具调用] execute_command("${command}") - 执行失败，退出码: ${code}`);
                        resolve(`命令执行失败，退出码: ${code}${errorMsg ? '\n错误: ' + errorMsg : ''}`);
                    }
                });
            })

        } catch (error) {

        }
    },
    {
        name: 'execute_command',
        description: '执行命令',
        schema: z.object({
            command: z.string().describe('命令'),
            workingDirectory: z.string().optional().describe('工作目录（推荐指定）'),
        }),
    }
)

const listDirectoryTool = tool(
    async ({ directoryPath }) => {
        try {
            const files = await fs.readdir(directoryPath);
            console.log(`  [工具调用] list_directory("${directoryPath}") - 成功列出 ${files.length} 个文件`);
            return `目录内容:\n${files.join('\n')}`;
        } catch (error) {
            console.error(`  [工具调用] list_directory("${directoryPath}") - 列出失败: ${error.message}`);
            return `列出目录失败: ${error.message}`;
        }
    },
    {
        name: 'list_directory',
        description: '列出目录内容',
        schema: z.object({
            directoryPath: z.string().describe('目录路径'),
        }),
    }

)


// const fn = async ({ directoryPath }) => {
//     try {
//         const files = await fs.readdir(directoryPath);
//         console.log(`  [工具调用] list_directory("${directoryPath}") - 成功列出 ${files.length} 个文件`);
//         return `目录内容:\n${files.join('\n')}`;
//     } catch (error) {
//         console.error(`  [工具调用] list_directory("${directoryPath}") - 列出失败: ${error.message}`);
//         return `列出目录失败: ${error.message}`;
//     }
// }

// fn({directoryPath: './tool-test/src'})



export { readFileTool, writeFileTool, executeCommandTool, listDirectoryTool };