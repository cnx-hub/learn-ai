import { RouterRunnable, RunnableLambda } from '@langchain/core/runnables';

const toUpperCase = RunnableLambda.from((input) => input.toUpperCase());
const reverseText = RunnableLambda.from((input) => input.split("").reverse().join(""));

const router = new RouterRunnable({
    runnables: {
        toUpperCase,
        reverseText
    }
});

const res1 = await router.invoke({ key: 'toUpperCase', input: 'hello world' });
const res2 = await router.invoke({ key: 'reverseText', input: 'hello world' });

console.log(res1, res2);