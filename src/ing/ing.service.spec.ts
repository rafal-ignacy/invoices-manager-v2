import { Test, TestingModule } from '@nestjs/testing';
import { IngService } from './ing.service';

describe('IngService', () => {
  let service: IngService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IngService],
    }).compile();

    service = module.get<IngService>(IngService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
