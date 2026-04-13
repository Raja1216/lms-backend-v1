import { Controller, Get, Param, Req, Post, UseGuards } from '@nestjs/common';
import { CertificateService } from './certificate.service';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@Controller('certificate')
export class CertificateController {
  constructor(private readonly service: CertificateService) {}

  // ✅ GET /certificate/my
  @ApiTags('Certificate')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMy(@Req() req) {
    const userId = req.user.id; // assuming auth guard
    const data = await this.service.getMyCertificates(userId);

    return { data };
  }

  // ✅ GET /certificate/:id
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.service.getById(Number(id));
  }

  // ✅ GET /certificate/verify/:certificateNumber
  @Get('verify/:certificateNumber')
  async verify(@Param('certificateNumber') certificateNumber: string) {
    return this.service.verify(certificateNumber);
  }

  // ✅ POST /certificate/generate/project/:submissionId
  @Post('generate/project/:submissionId')
  async generateProject(@Param('submissionId') submissionId: string) {
    return this.service.generateFromProjectSubmission(Number(submissionId));
  }
}
