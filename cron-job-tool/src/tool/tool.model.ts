import { Module,forwardRef } from '@nestjs/common';
import { WebSearchToolService } from './web-search-tool.service';
import { SendMailToolService } from './send-mail-tool.service';
import { TimeNowToolService } from './time-now-tool.service';
import { LLMService } from './llm.service';
import { DbUsersCrudToolService } from './db-users-crud-tool.service';
import { CronJobToolService } from './cron-job-tool.service'
import { UsersModule } from '../users/users.module';
import { JobModule } from '../job/job.module';

@Module({
    imports: [UsersModule, forwardRef(() => JobModule)],
    providers: [
        SendMailToolService,
        WebSearchToolService,
        TimeNowToolService,
        LLMService,
        DbUsersCrudToolService,
        CronJobToolService,
        {
            provide: 'WEB_SEARCH_TOOL',
            useFactory: (svc: WebSearchToolService) => svc.tool,
            inject: [WebSearchToolService],
        },
        {
            provide: 'SEND_MAIL_TOOL',
            useFactory: (svc: SendMailToolService) => svc.tool,
            inject: [SendMailToolService],
        },
        {
            provide: 'TIME_NOW_TOOL',
            useFactory: (svc: TimeNowToolService) => svc.tool,
            inject: [TimeNowToolService],
        },
        {
            provide: 'CHAT_MODEL',
            useFactory: (llmService: LLMService) => llmService.getModel(),
            inject: [LLMService],
        },
        {
            provide: 'DB_USERS_CRUD_TOOL',
            useFactory: (svc: DbUsersCrudToolService) => svc.tool,
            inject: [DbUsersCrudToolService],
        },
        {
            provide: 'CRON_JOB_TOOL',
            useFactory: (svc: CronJobToolService) => svc.tool,
            inject: [CronJobToolService],
        },
    ],
    exports: ['WEB_SEARCH_TOOL', 'SEND_MAIL_TOOL', 'TIME_NOW_TOOL', 'CHAT_MODEL', 'DB_USERS_CRUD_TOOL', 'CRON_JOB_TOOL'],
})
export class ToolModule { }
