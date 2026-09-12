import 'dotenv/config';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';


async function main() {

    const client = new S3Client({
        region: 'us-east-1', // MinIO 不关心 region，但 SDK 要求必填
        endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
        credentials: {
            accessKeyId: process.env.MINIO_ACCESS_KEY,
            secretAccessKey: process.env.MINIO_SECRET_KEY,
        },
        forcePathStyle: true, // MinIO 必须使用 path-style
    });

    const bucket = process.env.MINIO_BUCKET || 'agent-bucket123';

    // 生成 presigned POST policy
    const presignedPost = await createPresignedPost(client, {
        Bucket: bucket,
        Key: '${filename}', // 前端上传时替换为实际文件名
        Conditions: [
            ['content-length-range', 0, 1048576000], // 文件大小限制 1GB
        ],
        Expires: 60 * 60 * 24, // 凭证有效期 24 小时（秒）
    });

    console.log('presignedPost fields:', presignedPost.fields);
    console.log('upload url:', presignedPost.url);
}

main();
