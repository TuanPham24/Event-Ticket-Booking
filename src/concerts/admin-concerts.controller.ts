import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ConcertsService } from './concerts.service';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import { CreateTicketCategoryDto } from './dto/create-ticket-category.dto';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Concerts (Admin)')
@ApiBearerAuth()
@Roles(Role.OPERATOR)
@Controller('admin/concerts')
export class AdminConcertsController {
  constructor(private readonly concertsService: ConcertsService) {}

  @Get()
  @ApiOperation({ summary: 'List all concerts regardless of status' })
  list() {
    return this.concertsService.adminList();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get a concert (any status) with ticket categories/availability',
  })
  findOne(@Param('id') id: string) {
    return this.concertsService.adminFindOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new concert (starts as DRAFT)' })
  create(@Body() dto: CreateConcertDto) {
    return this.concertsService.adminCreate(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update concert details' })
  update(@Param('id') id: string, @Body() dto: UpdateConcertDto) {
    return this.concertsService.adminUpdate(id, dto);
  }

  @Patch(':id/publish')
  @ApiOperation({
    summary: 'Publish a concert so it becomes visible to customers',
  })
  publish(@Param('id') id: string) {
    return this.concertsService.adminPublish(id);
  }

  @Post(':id/ticket-categories')
  @ApiOperation({
    summary:
      'Add a ticket category (e.g. VIP, Standard) with its price and quantity',
  })
  createTicketCategory(
    @Param('id') id: string,
    @Body() dto: CreateTicketCategoryDto,
  ) {
    return this.concertsService.adminCreateTicketCategory(id, dto);
  }
}
