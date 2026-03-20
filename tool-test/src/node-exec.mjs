import { spawn } from "child_process"
const command = 'echo -e "n\nn" | npm create vite@latest react-todo-app --template react-ts';


console.log(command.split(' '));
const cwd = process.cwd();
const [cmd, ...args] = command.split(' ');

// console.log(cmd, args);

const child = spawn(cmd, args, {
    cwd,
    stdio: 'inherit', // 实时输出到控制台
    shell: true,
});

let errorMsg = '';


child.on('error', (err) => {
    console.error('子进程启动失败:', err);
    errorMsg = err.message;
});

child.on('close', (code) => {
    if (code === 0) {
        process.exit(0);
    } else {
        if (errorMsg) {
            console.error(`错误: ${errorMsg}`);
        }
        process.exit(code || 1);
    }
});