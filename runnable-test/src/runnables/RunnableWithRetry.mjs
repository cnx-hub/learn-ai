import { RunnableLambda } from '@langchain/core/runnables';

let attempt = 0;

const unstableRunnable = RunnableLambda.from((input) => {
    attempt++;
    console.log(`第 ${attempt} 次尝试，输入: ${input}`);


    if (Math.random() < 0.7) {
        console.log("本次尝试失败，抛出错误。");
        throw new Error("模拟的随机错误");
    }

    console.log("本次尝试成功。");
    return `成功处理: ${input}`;
});

const runnableWithRetry = unstableRunnable.withRetry({
    stopAfterAttempt: 5
});



try {
    const result = await runnableWithRetry.invoke('演示 withRetry');
    console.log("✅ 最终结果:", result);
} catch (error) {
    console.error("❌ 重试多次后仍然失败:", err?.message ?? err);
}