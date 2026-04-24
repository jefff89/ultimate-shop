import { Body, Controller, Post } from '@nestjs/common';
import { CreateTagDto } from './dtos/create-tag-dto';
import { TagsService } from './tags.service';

@Controller('tags')
export class TagsController {
  constructor(private tagsService: TagsService) {}

  @Post()
  async createTag(@Body() body: CreateTagDto) {
    await this.tagsService.create(body.name);
  }
}
