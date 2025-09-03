import { MigrationInterface, QueryRunner } from "typeorm";
import * as fs from 'fs';
import * as path from 'path';

export class InitalizeMigration1756829557402 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {
    const sqlPath = path.resolve(__dirname, 'sql/001-initializeTables.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await queryRunner.query(sql);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
  }

}
