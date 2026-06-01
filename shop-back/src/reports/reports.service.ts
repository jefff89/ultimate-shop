import { Injectable, NotFoundException } from '@nestjs/common';
import { Report } from './report.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateReportDto } from './dtos/create-report-dto';
import { User } from 'src/users/user.entity';
import { GetEstimateDto } from './dtos/get-estimate.dto';
@Injectable()
export class ReportsService {
  constructor(@InjectRepository(Report) private repo: Repository<Report>) {}

  async create(reportDto: CreateReportDto, userId: string): Promise<Report> {
    const report = this.repo.create(reportDto);
    // Attach ownership by id (the authenticated principal only carries the id,
    // not a full User entity). TypeORM persists this as the FK.
    report.user = { id: userId } as User;
    return this.repo.save(report);
  }

  async changeApproval(id: string, approved: boolean) {
    const report = await this.repo.findOne({ where: { id: parseInt(id) } });
    if (!report) {
      throw new NotFoundException('report not found');
    }
    report.approved = approved;
    return this.repo.save(report);
  }

  // createEstimate(estimateDto: GetEstimateDto) {
  createEstimate({ make, model, lng, lat, year, mileage }: GetEstimateDto) {
    return (
      this.repo
        .createQueryBuilder()
        .select('AVG(price)', 'price')
        // .where('make = :make', { make: estimateDto.make })
        .where('make = :make', { make })
        .andWhere('model = :model', { model })
        .andWhere('lng - :lng BETWEEN -5 AND 5', { lng })
        .andWhere('lat - :lat BETWEEN -5 AND 5', { lat })
        .andWhere('year - :year BETWEEN -3 AND 3', { year })
        .andWhere('approved IS TRUE')
        .orderBy('ABS(mileage - :mileage)', 'DESC')
        .setParameters({ mileage })
        .limit(3)
        .getRawOne()
    );
  }
}
