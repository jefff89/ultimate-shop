import { Injectable } from '@nestjs/common';
import { Report } from './report.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateReportDto } from './dtos/create-report-dto';
import { User } from 'src/users/user.entity';
@Injectable()
export class ReportsService {
  constructor(@InjectRepository(Report) private repo: Repository<Report>) {}
  async create(reportDto: CreateReportDto, user: User): Promise<Report> {
    const report = this.repo.create(reportDto);
    report.user = user;
    return this.repo.save(report);
  }
}
