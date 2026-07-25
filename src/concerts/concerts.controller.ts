import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConcertsService } from './concerts.service';
import { ListConcertsQuery } from './dto/list-concerts.query';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('Concerts (Public)')
@Controller('concerts')
export class ConcertsController {
  constructor(private readonly concertsService: ConcertsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Browse published concerts' })
  findPublished(@Query() query: ListConcertsQuery) {
    return this.concertsService.findPublished(query);
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'View a published concert with its ticket categories and prices',
  })
  findOne(@Param('id') id: string) {
    return this.concertsService.findOnePublished(id);
  }
}
