import {
  Body,
  Controller,
  Patch,
  Post,
  UseGuards,
  Param,
  Get,
  Query,
} from '@nestjs/common';
import { CreateReportDto } from './dtos/create-report-dto';
import { ReportsService } from './reports.service';
import { CurrentUser } from 'src/users/decorators/current-user.decorator';
import { ReportDto } from './dtos/report.dto';
import { Serialize } from 'src/interceptors/serialize.interceptor';
import { ApprovedReportDto } from './dtos/approve-report.dto';
import { AdminGuard } from 'src/guards/admin.gurad';
import { JwtAuthGuard } from 'src/users/auth/guards/jwt-auth.guard';
import { GetEstimateDto } from './dtos/get-estimate.dto';
import type { AuthenticatedUser } from 'src/users/auth/strategies/jwt.strategy';
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}
  @Get()
  getEstimate(@Query() query: GetEstimateDto) {
    return this.reportsService.createEstimate(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @Serialize(ReportDto) // to format the report to have userId instead of the whole user information in its response
  createReport(
    @Body() body: CreateReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.create(body, user.userId);
  }

  @Patch('/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  approvedReport(@Param('id') id: string, @Body() body: ApprovedReportDto) {
    return this.reportsService.changeApproval(id, body.approved);
  }
}
