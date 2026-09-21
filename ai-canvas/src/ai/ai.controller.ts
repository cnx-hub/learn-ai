import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AiService } from './ai.service';
import { CreateAiDto } from './dto/create-ai.dto';
import { UpdateAiDto } from './dto/update-ai.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

   @Get('oss/upload-signature')

     @Get('image/list')

       @Post('image')

         @Delete('image/:id')

}
