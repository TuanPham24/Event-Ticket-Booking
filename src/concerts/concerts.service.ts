import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConcertStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';
import { CreateConcertDto } from './dto/create-concert.dto';
import { UpdateConcertDto } from './dto/update-concert.dto';
import { CreateTicketCategoryDto } from './dto/create-ticket-category.dto';
import { ListConcertsQuery } from './dto/list-concerts.query';

const LIST_CACHE_TTL_SECONDS = 20;
const DETAIL_CACHE_TTL_SECONDS = 20;
const LIST_CACHE_PREFIX = 'concerts:list';
const DETAIL_CACHE_PREFIX = 'concerts:detail';

@Injectable()
export class ConcertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // --- Public, customer-facing ---

  async findPublished(query: ListConcertsQuery) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const cacheKey = `${LIST_CACHE_PREFIX}:${page}:${pageSize}`;

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.concert.findMany({
        where: { status: ConcertStatus.PUBLISHED },
        include: { ticketCategories: true },
        orderBy: { startTime: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.concert.count({ where: { status: ConcertStatus.PUBLISHED } }),
    ]);

    const result = { items, total, page, pageSize };
    await this.cache.set(cacheKey, result, LIST_CACHE_TTL_SECONDS);
    return result;
  }

  async findOnePublished(id: string) {
    const cacheKey = `${DETAIL_CACHE_PREFIX}:${id}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const concert = await this.prisma.concert.findFirst({
      where: { id, status: ConcertStatus.PUBLISHED },
      include: { ticketCategories: true },
    });
    if (!concert) {
      throw new NotFoundException('Concert not found');
    }

    await this.cache.set(cacheKey, concert, DETAIL_CACHE_TTL_SECONDS);
    return concert;
  }

  // --- Admin / operation dashboard ---

  async adminList() {
    return this.prisma.concert.findMany({
      include: { ticketCategories: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async adminFindOne(id: string) {
    const concert = await this.prisma.concert.findUnique({
      where: { id },
      include: { ticketCategories: true },
    });
    if (!concert) {
      throw new NotFoundException('Concert not found');
    }
    return concert;
  }

  async adminCreate(dto: CreateConcertDto) {
    return this.prisma.concert.create({
      data: {
        name: dto.name,
        description: dto.description,
        venue: dto.venue,
        startTime: new Date(dto.startTime),
        status: ConcertStatus.DRAFT,
      },
      include: { ticketCategories: true },
    });
  }

  async adminUpdate(id: string, dto: UpdateConcertDto) {
    await this.adminFindOne(id);
    const concert = await this.prisma.concert.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.venue !== undefined && { venue: dto.venue }),
        ...(dto.startTime !== undefined && {
          startTime: new Date(dto.startTime),
        }),
      },
      include: { ticketCategories: true },
    });
    await this.invalidateCache(id);
    return concert;
  }

  async adminPublish(id: string) {
    const concert = await this.adminFindOne(id);
    if (concert.ticketCategories.length === 0) {
      throw new BadRequestException(
        'Cannot publish a concert with no ticket categories',
      );
    }
    const updated = await this.prisma.concert.update({
      where: { id },
      data: { status: ConcertStatus.PUBLISHED },
      include: { ticketCategories: true },
    });
    await this.invalidateCache(id);
    return updated;
  }

  async adminCreateTicketCategory(
    concertId: string,
    dto: CreateTicketCategoryDto,
  ) {
    await this.adminFindOne(concertId);
    const category = await this.prisma.ticketCategory.create({
      data: {
        concertId,
        name: dto.name,
        price: dto.price,
        totalQuantity: dto.totalQuantity,
        availableQuantity: dto.totalQuantity,
      },
    });
    await this.invalidateCache(concertId);
    return category;
  }

  private async invalidateCache(concertId: string) {
    await this.cache.del(`${DETAIL_CACHE_PREFIX}:${concertId}`);
    await this.cache.del(`${LIST_CACHE_PREFIX}:*`);
  }
}
