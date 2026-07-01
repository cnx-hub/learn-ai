import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Neo4jGraph } from '@langchain/community/graphs/neo4j_graph';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env'), quiet: true });

const graph = new Neo4jGraph({
    url: 'bolt://localhost:7687',
    username: 'neo4j',
    password: '12345678'
});

async function initGraph() {
    console.log('\n=== 开始初始化 Neo4j 知识图谱 ===\n');

    try {
        console.log('1. 清空现有数据...');
        await graph.query('MATCH (n) DETACH DELETE n');
        console.log('✓ 已清空\n');

        console.log('2. 创建节点...');

        // 创建奶茶产品
        await graph.query(`CREATE (product:Product {name: "珍珠奶茶"})`);
        console.log('✓ 创建 Product: 珍珠奶茶');

        // 创建奶茶类型
        await graph.query(`CREATE (type1:Type {name: "台式奶茶"})`);
        await graph.query(`CREATE (type2:Type {name: "港式奶茶"})`);
        console.log('✓ 创建 Type: 台式奶茶, 港式奶茶');

        // 创建配料
        await graph.query(`CREATE (ing1:Ingredient {name: "珍珠"})`);
        await graph.query(`CREATE (ing2:Ingredient {name: "芋圆"})`);
        await graph.query(`CREATE (ing3:Ingredient {name: "果糖"})`);
        await graph.query(`CREATE (ing4:Ingredient {name: "红茶"})`);
        await graph.query(`CREATE (ing5:Ingredient {name: "牛奶"})`);
        console.log('✓ 创建 Ingredient: 珍珠, 芋圆, 果糖, 红茶, 牛奶');

        // 创建制作工艺
        await graph.query(`CREATE (method1:Method {name: "煮制"})`);
        await graph.query(`CREATE (method2:Method {name: "冲泡"})`);
        console.log('✓ 创建 Method: 煮制, 冲泡');

        // 创建适用人群
        await graph.query(`CREATE (people1:People {name: "年轻人"})`);
        await graph.query(`CREATE (people2:People {name: "学生"})`);
        await graph.query(`CREATE (people3:People {name: "甜食爱好者"})`);
        console.log('✓ 创建 People: 年轻人, 学生, 甜食爱好者\n');

        console.log('3. 创建关系...');

        // 珍珠奶茶 属于 台式奶茶
        await graph.query(`
            MATCH (p:Product {name: "珍珠奶茶"}), (t:Type {name: "台式奶茶"})
            CREATE (p)-[:属于]->(t)
        `);
        console.log('✓ 关系: 珍珠奶茶 -[:属于]-> 台式奶茶');

        // 珍珠奶茶 包含 配料
        await graph.query(`
            MATCH (p:Product {name: "珍珠奶茶"}), (i:Ingredient {name: "珍珠"})
            CREATE (p)-[:包含]->(i)
        `);
        await graph.query(`
            MATCH (p:Product {name: "珍珠奶茶"}), (i:Ingredient {name: "果糖"})
            CREATE (p)-[:包含]->(i)
        `);
        await graph.query(`
            MATCH (p:Product {name: "珍珠奶茶"}), (i:Ingredient {name: "红茶"})
            CREATE (p)-[:包含]->(i)
        `);
        await graph.query(`
            MATCH (p:Product {name: "珍珠奶茶"}), (i:Ingredient {name: "牛奶"})
            CREATE (p)-[:包含]->(i)
        `);
        console.log('✓ 关系: 珍珠奶茶 -[:包含]-> 配料');

        // 配料 使用 制作工艺
        await graph.query(`
            MATCH (i:Ingredient {name: "珍珠"}), (m:Method {name: "煮制"})
            CREATE (i)-[:使用]->(m)
        `);
        console.log('✓ 关系: 珍珠 -[:使用]-> 煮制');

        // 珍珠奶茶 适合 人群
        await graph.query(`
            MATCH (p:Product {name: "珍珠奶茶"}), (peo:People {name: "年轻人"})
            CREATE (p)-[:适合]->(peo)
        `);
        await graph.query(`
            MATCH (p:Product {name: "珍珠奶茶"}), (peo:People {name: "学生"})
            CREATE (p)-[:适合]->(peo)
        `);
        await graph.query(`
            MATCH (p:Product {name: "珍珠奶茶"}), (peo:People {name: "甜食爱好者"})
            CREATE (p)-[:适合]->(peo)
        `);
        console.log('✓ 关系: 珍珠奶茶 -[:适合]-> 人群\n');

        console.log('4. 验证数据...');
        const nodeCount = await graph.query('MATCH (n) RETURN count(n) AS count');
        const relCount = await graph.query('MATCH ()-[r]->() RETURN count(r) AS count');
        console.log(`✓ 节点数量: ${nodeCount[0].count}`);
        console.log(`✓ 关系数量: ${relCount[0].count}\n`);

        console.log('=== 初始化完成！===\n');
        console.log('你可以打开 http://localhost:7474 查看 Neo4j 浏览器');
        console.log('运行查询: MATCH (n)-[r]->(m) RETURN n, r, m');

    } catch (error) {
        console.error('\n❌ 初始化失败:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await graph.close();
    }
}

initGraph();
