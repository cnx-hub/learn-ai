declare module 'snowflake-id' {
  export interface SnowflakeIdOptions {
    /** 机器/worker ID，取值 1-1023 */
    mid?: number;
    /** 时间戳偏移（自定义纪元），毫秒 */
    offset?: number;
  }

  export default class SnowflakeId {
    constructor(options?: SnowflakeIdOptions);
    /** 生成雪花 ID，十进制字符串 */
    generate(): string;
  }
}
