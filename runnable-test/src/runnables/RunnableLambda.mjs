import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables"

const addOne = RunnableLambda.from((input) => {
    console.log(`输入: ${input}`);
    return input + 1
});

const mutiplyTwo = RunnableLambda.from((input) => {
    console.log(`输入: ${input}`);
    return input * 2
});

const chain = RunnableSequence.from([
    addOne,
    mutiplyTwo,
    addOne
]);

const result = await chain.invoke(1);

console.log(result, 'result')