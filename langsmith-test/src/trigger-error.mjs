import 'dotenv/config';
import { StateGraph, START, END, Annotation } from '@langchain/langgraph';

const state = Annotation.Root({
    text: Annotation({
        reducer: (_prev, next) => next,
        default: () => "",
    }),
});

const stepOk = ({ text }) => ({
    text: `${text} ok`,
});

const stepError = ({ text }) => {
    throw new Error("DemoError: 节点内故意抛错（trigger-error.mjs）");
};


const graph = new StateGraph(state).addNode("stepOk", stepOk)
    .addNode("stepError", stepError)
    .addEdge(START, "stepOk")
    .addEdge("stepOk", "stepError")
    .addEdge("stepError", END)
    .compile();


try {
    await graph.invoke({ text: "hello" });
    console.log("不应执行到这里");
} catch (err) {
    console.error("已捕获:", err?.message ?? err);
    process.exitCode = 1;
}