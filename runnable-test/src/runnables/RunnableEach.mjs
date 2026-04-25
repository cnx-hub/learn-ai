import { RunnableEach, RunnableSequence } from '@langchain/core/runnables';

const processItem = RunnableSequence.from(
    [
        (input) => input.toUpperCase(),
        (input) => `你好，${input}！`
    ]
)

const chain = new RunnableEach({
    bound: processItem
})

const input = ["alice", "bob", "carol"];

const res = await chain.invoke(input);
console.log('输入：', input)
console.log('输出：', res)